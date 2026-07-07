import { promises as fs } from "fs";

import { verifyXmlRoundtrip } from "../";

const sampleDir: string = "fixtures";
const mockDir: string = "mock-verify";

describe("verifyXmlRoundtrip test suite", () => {
  beforeAll(async () => {
    await fs.cp(sampleDir, mockDir, { recursive: true, force: true });
  });

  afterAll(async () => {
    await fs.rm(mockDir, { recursive: true });
  });

  it("does not touch the caller's file", async () => {
    const filePath = `${mockDir}/general/HR_Admin.permissionset-meta.xml`;
    const before = await fs.readFile(filePath, "utf-8");

    await verifyXmlRoundtrip({
      filePath,
      uniqueIdElements:
        "application,apexClass,name,externalDataSource,flow,object,apexPage,recordType,tab,field",
    });

    const after = await fs.readFile(filePath, "utf-8");
    expect(after).toBe(before);
    // Verification must not leave a disassembled directory behind either.
    await expect(
      fs.stat(`${mockDir}/general/HR_Admin`),
    ).rejects.toThrow();
  });

  it("reports identical/reordered (not drift) for a real, well-formed metadata file", async () => {
    const result = await verifyXmlRoundtrip({
      filePath: `${mockDir}/general/HR_Admin.permissionset-meta.xml`,
      uniqueIdElements:
        "application,apexClass,name,externalDataSource,flow,object,apexPage,recordType,tab,field",
    });

    expect(["identical", "reordered"]).toContain(result.status);
    expect(result.reason).toBeUndefined();
  });

  it("reports drift for a file that cannot be disassembled at all", async () => {
    const filePath = `${mockDir}/broken.xml`;
    await fs.writeFile(filePath, "<<not xml");

    const result = await verifyXmlRoundtrip({ filePath });

    expect(result.status).toBe("drift");
    expect(result.reason).toBeTruthy();
  });
});
