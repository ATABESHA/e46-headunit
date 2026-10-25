// Example plugin: runs inside the core service.
//
// Turn it on in core/config.local.json (copy config.json first):
//   "plugins": {
//     "simulator": { "enabled": true },
//     "my-plugin": { "enabled": true, "path": "../examples/my-plugin.js", "limit": 120 }
//   }
//
// This one warns when you drive faster than the limit.
export default function myPlugin(hub, options) {
  let limit = options.limit ?? 120;

  const onState = (topic, value) => {
    if (topic === 'vehicle.speed') hub.set('my.overSpeed', value > limit);
  };
  hub.on('state', onState);

  const removeCommand = hub.onCommand('my.setLimit', (value) => {
    if (typeof value !== 'number') throw new Error('Limit must be a number');
    limit = value;
    return value;
  });

  return {
    stop() {
      hub.off('state', onState);
      removeCommand();
    },
  };
}
