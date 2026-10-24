import { deflateRawSync, inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { readXlsx, XlsxError } from "./xlsx";

/** A minimal zip writer for the test: each file stored or deflated, with a central directory */
function zip(files: Record<string, string>, deflate = true): Uint8Array {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBytes = enc.encode(name);
    const raw = enc.encode(text);
    const data = deflate ? new Uint8Array(deflateRawSync(raw)) : raw;
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, deflate ? 8 : 0, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, deflate ? 8 : 0, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const cdSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, centrals.length, true);
  ev.setUint16(10, centrals.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  const all = [...locals, ...centrals, end];
  const out = new Uint8Array(all.reduce((n, a) => n + a.length, 0));
  let p = 0;
  for (const a of all) {
    out.set(a, p);
    p += a.length;
  }
  return out;
}

const book = {
  "xl/workbook.xml": '<workbook><sheets><sheet name="Dues" sheetId="1" r:id="rId7"/></sheets></workbook>',
  "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId7" Type="worksheet" Target="worksheets/dues.xml"/></Relationships>',
  "xl/sharedStrings.xml": "<sst><si><t>Bill No</t></si><si><t>Party</t></si><si><r><t>Sharma </t></r><r><t>&amp; Sons</t></r></si><si><t>Due Date</t></si></sst>",
  "xl/worksheets/dues.xml":
    '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="D1" t="s"><v>3</v></c></row>' +
    '<row r="2"><c r="A2" t="inlineStr"><is><t>INV-7</t></is></c><c r="B2" t="s"><v>2</v></c><c r="C2"><v>125000.5</v></c><c r="D2"><v>46300</v></c></row>' +
    '<row r="3"></row></sheetData></worksheet>',
};

const inflate = async (d: Uint8Array) => new Uint8Array(inflateRawSync(d));

describe("xlsx reader", () => {
  it("reads the first sheet with shared, inline and rich text", async () => {
    const rows = await readXlsx(zip(book), { inflate });
    expect(rows).toEqual([
      ["Bill No", "Party", "", "Due Date"],
      ["INV-7", "Sharma & Sons", "125000.5", "46300"],
    ]);
  });

  it("reads stored (uncompressed) entries", async () => {
    expect((await readXlsx(zip(book, false), { inflate }))[1][0]).toBe("INV-7");
  });

  it("refuses something that isn't a zip", async () => {
    await expect(readXlsx(new TextEncoder().encode("a,b,c\n1,2,3"), { inflate })).rejects.toBeInstanceOf(XlsxError);
  });
});
