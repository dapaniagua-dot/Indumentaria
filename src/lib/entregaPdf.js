import { jsPDF } from "jspdf";

export function generateEntregaPDF(entrega) {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.setFont(undefined, "bold");
  doc.text("REMITO DE ENTREGA DE INDUMENTARIA", 105, 20, { align: "center" });

  doc.setFontSize(10);
  doc.setFont(undefined, "normal");
  doc.line(20, 25, 190, 25);

  doc.setFontSize(10);
  doc.text(`Fecha y hora: ${entrega.fecha_hora}`, 20, 35);
  doc.text(`Nombre: ${entrega.receptor_nombre} ${entrega.receptor_apellido}`, 20, 43);
  doc.text(`DNI: ${entrega.receptor_dni || "-"}`, 20, 51);
  doc.text(`Sector: ${entrega.sector || "-"}`, 20, 59);

  doc.line(20, 65, 190, 65);

  doc.setFont(undefined, "bold");
  doc.text("PRENDAS ENTREGADAS", 20, 73);
  doc.setFont(undefined, "normal");

  // Table headers
  let y = 82;
  doc.setFontSize(9);
  doc.setFont(undefined, "bold");
  doc.text("#", 20, y);
  doc.text("Producto", 30, y);
  doc.text("SKU", 110, y);
  doc.text("Talle", 145, y);
  doc.text("Color", 162, y);
  doc.text("Cant.", 183, y);
  doc.setFont(undefined, "normal");
  y += 3;
  doc.line(20, y, 190, y);
  y += 5;

  (entrega.prendas || []).forEach((p, i) => {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.text(`${i + 1}`, 20, y);
    const nombre = p.product_name || "";
    doc.text(nombre.length > 35 ? nombre.substring(0, 35) + "..." : nombre, 30, y);
    doc.text(p.sku || "-", 110, y);
    doc.text(p.size || "-", 145, y);
    doc.text(p.color || "-", 162, y);
    doc.text(String(p.quantity), 183, y);
    y += 8;
  });

  doc.line(20, y, 190, y);
  y += 8;
  doc.setFont(undefined, "bold");
  doc.setFontSize(11);
  doc.text(`TOTAL PRENDAS: ${entrega.total_prendas}`, 20, y);

  y += 20;
  doc.setFont(undefined, "normal");
  doc.setFontSize(10);
  doc.text(`Entrega realizada por: ${entrega.entregado_por_nombre || ""} (${entrega.entregado_por_email || ""})`, 20, y);

  y += 25;
  doc.text("Firma del receptor: _________________________________", 20, y);
  y += 15;
  doc.text("Aclaración: _________________________________", 20, y);

  return doc;
}