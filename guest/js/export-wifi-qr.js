/* Writes guest/assets/wifi-qr.png from guest/js/wifi-config.js. */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const wifi = require("./wifi-config.js");
const qrcode = require("./qrcode.js");

const qr = qrcode(0, "M");
qr.addData(wifi.wifiPayload());
qr.make();

const count = qr.getModuleCount();
const scale = 24;
const quiet = 4;
const size = (count + quiet * 2) * scale;
const raw = Buffer.alloc((size + 1) * size);

for (let y = 0; y < size; y++) {
  const row = y * (size + 1);
  raw[row] = 0;
  const moduleY = Math.floor(y / scale) - quiet;
  for (let x = 0; x < size; x++) {
    const moduleX = Math.floor(x / scale) - quiet;
    const dark = moduleY >= 0 && moduleY < count && moduleX >= 0 && moduleX < count && qr.isDark(moduleY, moduleX);
    raw[row + 1 + x] = dark ? 0x1c : 0xff;
  }
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const name = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([name, data])) >>> 0, 0);
  return Buffer.concat([length, name, data, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(size, 0);
ihdr.writeUInt32BE(size, 4);
ihdr[8] = 8;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0))
]);

const out = path.join(__dirname, "..", "assets", "wifi-qr.png");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
process.stdout.write(out + " " + size + "px " + wifi.wifiPayload() + "\n");
