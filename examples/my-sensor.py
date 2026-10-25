#!/usr/bin/env python3
"""
Example: your own program talking to the head unit.

It sends a value (a fake oil temperature) and prints the car speed.
Any program in any language can do this - it is just JSON over a WebSocket.

    sudo apt install python3-websockets
    python3 examples/my-sensor.py
"""
import asyncio
import json
import random

import websockets

HUB = "ws://127.0.0.1:8765"


async def main():
    async with websockets.connect(HUB) as ws:

        async def send_sensor():
            while True:
                value = round(95 + random.uniform(-2, 2), 1)
                await ws.send(json.dumps({"type": "publish", "topic": "my.oilTemp", "value": value}))
                await asyncio.sleep(1)

        async def listen():
            async for raw in ws:
                msg = json.loads(raw)
                if msg["type"] == "state" and msg["topic"] == "vehicle.speed":
                    print(f"speed: {msg['value']} km/h")

        await asyncio.gather(send_sensor(), listen())


asyncio.run(main())
