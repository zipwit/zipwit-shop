/** Lua scripts use only keys in a single product hash slot (or one pointer key). */
export const claimPointer = `
local current = redis.call('GET', KEYS[1])
if current then
 local previous = cjson.decode(current)
 local incoming = cjson.decode(ARGV[1])
 if previous.id ~= incoming.id then return redis.error_reply('Catalog identity already belongs to another product') end
 if previous.revision > incoming.revision then return 0 end
end
redis.call('SET', KEYS[1], ARGV[1])
return 1
`;
export const releasePointer = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0
`;

export const writeProduct = `
local previous = redis.call('JSON.GET', KEYS[1])
if previous and cjson.decode(previous).updatedAt >= ARGV[1] then return 0 end
local revision = redis.call('GET', KEYS[3])
if revision and revision >= ARGV[1] then return 0 end
redis.call('JSON.SET', KEYS[1], '$', ARGV[2])
if ARGV[3] == '' then
 redis.call('DEL', KEYS[2])
else
 redis.call('JSON.SET', KEYS[2], '$', ARGV[3])
 if ARGV[4] ~= '' then redis.call('EXPIREAT', KEYS[2], ARGV[4]) else redis.call('PERSIST', KEYS[2]) end
end
redis.call('SET', KEYS[3], ARGV[1])
return 1
`;
export const deleteProduct = `
local current = redis.call('JSON.GET', KEYS[1])
if not current or cjson.decode(current).updatedAt ~= ARGV[1] then return 0 end
redis.call('DEL', KEYS[1], KEYS[2])
redis.call('SET', KEYS[3], ARGV[2])
return 1
`;
