import XlsxPopulate from 'xlsx-populate';

export const testExcel = async () => {
  try {
    const workbook = await XlsxPopulate.fromBlankAsync();
    workbook.sheet(0).cell("A1").value("Hello World!");
    const blob = await workbook.outputAsync({ password: "test" });
    console.log("Excel generated! Blob size:", blob.size);
    return blob;
  } catch (err) {
    console.error("Excel generation failed:", err);
    throw err;
  }
};
