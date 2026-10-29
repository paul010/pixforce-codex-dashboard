import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { once } from 'node:events';
import { startBroker, mqttPacket, mqttString } from '../mqtt.mjs';

test('closing an old connection keeps the replacement subscription and frame delivery healthy', { timeout: 5000 }, async (t) => {
  let status;
  const broker = startBroker({ port: 0, host: '127.0.0.1', device: '127.0.0.1', onState: value => { status = value; } });
  await once(broker.server, 'listening');
  const sockets = [];
  t.after(() => { sockets.forEach(socket => socket.destroy()); broker.close(); });
  async function client() {
    const socket = net.connect(broker.server.address().port, '127.0.0.1');
    sockets.push(socket);
    await once(socket, 'connect');
    const connected = once(socket, 'data');
    socket.write(mqttPacket(0x10, Buffer.concat([mqttString('MQTT'), Buffer.from([4, 2, 0, 30]), mqttString('clock')])));
    assert.deepEqual((await connected)[0], Buffer.from([0x20, 2, 0, 0]));
    const subscribed = once(socket, 'data');
    socket.write(mqttPacket(0x82, Buffer.concat([Buffer.from([0, 1]), mqttString('awtrixmatrix/#'), Buffer.from([0])])));
    await subscribed;
    return socket;
  }
  const old = await client();
  const replacement = await client();
  assert.equal(status, 'subscribed');
  const removed = once([...broker.peers][0], 'close');
  old.destroy(); await removed;
  assert.equal(broker.peers.size, 1);
  assert.equal(status, 'subscribed');
  const frame = once(replacement, 'data');
  assert.equal(broker.send(Buffer.from([1, 2, 3])), 1);
  assert.ok((await frame)[0].includes(Buffer.from([1, 2, 3])));
});
