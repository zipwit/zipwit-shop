import { ensure, PublicError } from "#/server/public-error";
import type { getRedis } from "#/server/redis.server";
import {
	hasCurrencyConflict,
	MAX_CART_LINES,
	MAX_QUANTITY,
	unavailableCartEntries,
} from "./cart";

export const CART_TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_ADD_ATTEMPTS = 8;

type CartRedis = Pick<
	Awaited<ReturnType<typeof getRedis>>,
	"hKeys" | "hGetAll" | "eval"
>;
type FindAvailableSkus = (
	ids: string[],
) => Promise<{ id: string; currency: string }[]>;

const addScript = `
local count = redis.call('HLEN', KEYS[1])
if count ~= #ARGV - 4 then return 'changed' end
for i = 5, #ARGV do
	if redis.call('HEXISTS', KEYS[1], ARGV[i]) == 0 then return 'changed' end
end

local current = redis.call('HGET', KEYS[1], ARGV[1])
if not current and count >= tonumber(ARGV[3]) then return 'full' end
local quantity = tonumber(current or '0')
if not quantity or quantity < 0 or quantity ~= math.floor(quantity) then
	return 'invalid'
end
if quantity >= tonumber(ARGV[4]) then return 'maximum' end

redis.call('HSET', KEYS[1], ARGV[1], quantity + 1)
redis.call('EXPIRE', KEYS[1], ARGV[2])
return 'added'
`;

const setQuantityScript = `
if redis.call('HEXISTS', KEYS[1], ARGV[1]) == 0 then return 0 end
if tonumber(ARGV[2]) == 0 then
	redis.call('HDEL', KEYS[1], ARGV[1])
else
	redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
end
redis.call('EXPIRE', KEYS[1], ARGV[3])
return 1
`;

const removePurchasedScript = `
for i = 1, #ARGV, 2 do
	local quantity = tonumber(redis.call('HGET', KEYS[1], ARGV[i]) or '0')
	local remaining = quantity - tonumber(ARGV[i + 1])
	if remaining > 0 then redis.call('HSET', KEYS[1], ARGV[i], remaining)
	else redis.call('HDEL', KEYS[1], ARGV[i]) end
end
return 1
`;

/**
 * Currency comes from the catalog. An add commits only if the SKU membership
 * checked against that catalog is still current. Quantity-only changes do not
 * invalidate it: the script checks current quantities and limits atomically.
 */
export function createCartStore(redis: CartRedis, findSkus: FindAvailableSkus) {
	return {
		async add(key: string, skuId: string) {
			for (let attempt = 0; attempt < MAX_ADD_ATTEMPTS; attempt++) {
				const ids = await redis.hKeys(key);
				const available = await findSkus([...new Set([...ids, skuId])]);
				const sku = available.find((item) => item.id === skuId);
				ensure(sku, "This item is no longer available.");
				ensure(
					!hasCurrencyConflict(available, sku.currency),
					"A cart can only hold one currency.",
				);
				const result = await redis.eval(addScript, {
					keys: [key],
					arguments: [
						skuId,
						String(CART_TTL_SECONDS),
						String(MAX_CART_LINES),
						String(MAX_QUANTITY),
						...ids,
					],
				});
				switch (result) {
					case "added":
						return;
					case "changed":
						continue;
					case "full":
						throw new PublicError(
							"Your cart is full. Remove an item before adding another.",
						);
					case "maximum":
						throw new PublicError("Maximum quantity reached.");
					default:
						throw new PublicError("Invalid cart quantity.");
				}
			}
			throw new PublicError("Your cart changed. Please try again.");
		},

		/** A stale quantity request cannot recreate a line removed by another client. */
		async setQuantity(key: string, skuId: string, quantity: number) {
			ensure(
				Number.isInteger(quantity) && quantity >= 0 && quantity <= MAX_QUANTITY,
				"Invalid cart quantity.",
			);
			await redis.eval(setQuantityScript, {
				keys: [key],
				arguments: [skuId, String(quantity), String(CART_TTL_SECONDS)],
			});
		},

		/** Recheck first; compare quantities atomically to preserve concurrent edits. */
		async removeUnavailable(key: string) {
			const entries = Object.entries(await redis.hGetAll(key));
			if (!entries.length) return;
			const available = await findSkus(entries.map(([id]) => id));
			const stale = unavailableCartEntries(
				entries,
				new Set(available.map((sku) => sku.id)),
			);
			if (!stale.length) return;
			await redis.eval(
				`
for i = 1, #ARGV, 2 do
 if redis.call('HGET', KEYS[1], ARGV[i]) == ARGV[i + 1] then
  redis.call('HDEL', KEYS[1], ARGV[i])
 end
end
return 1
`,
				{ keys: [key], arguments: stale.flat() },
			);
		},

		/** Subtract purchased quantities without discarding additions from another tab. */
		async removePurchased(
			key: string,
			items: { id: string; quantity: number }[],
		) {
			await redis.eval(removePurchasedScript, {
				keys: [key],
				arguments: items.flatMap((item) => [item.id, String(item.quantity)]),
			});
		},
	};
}
