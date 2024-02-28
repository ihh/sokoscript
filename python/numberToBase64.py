import base64
import struct

def int32ArrayToBase64String(a):
    buffer = bytearray(a)
    return base64.b64encode(buffer).decode('utf-8')

def base64StringToInt32Array(s):
    buffer = base64.b64decode(s)
    return [struct.unpack('<i', buffer[i:i+4])[0] for i in range(0, len(buffer), 4)]

