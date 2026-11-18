#!/bin/sh
set -eu

if ! redis-cli -h redis-1 CLUSTER INFO | tr -d '\r' | grep -q '^cluster_slots_assigned:16384$'; then
  redis-cli --cluster create redis-1:6379 redis-2:6379 redis-3:6379 --cluster-replicas 0 --cluster-yes
fi

attempt=0
while [ "$attempt" -lt 60 ]; do
  ready=true
  for node in redis-1 redis-2 redis-3; do
    if ! redis-cli -h "$node" CLUSTER INFO | tr -d '\r' | grep -q '^cluster_state:ok$'; then
      ready=false
    fi
  done
  if [ "$ready" = true ]; then
    echo 'Redis Cluster ready: three primaries, 16384 slots.'
    exit 0
  fi
  attempt=$((attempt + 1))
  sleep 1
done
echo 'Redis Cluster did not become ready; inspect the node logs.' >&2
exit 1
