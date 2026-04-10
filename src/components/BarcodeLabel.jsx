import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";

export default function BarcodeLabel({ product, type = "barcode" }) {
  const barcodeRef = useRef(null);
  const qrRef = useRef(null);

  useEffect(() => {
    if (type === "barcode" && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, product.sku, {
          format: "CODE128",
          width: 1.5,
          height: 40,
          displayValue: true,
          fontSize: 10,
          margin: 4,
        });
      } catch (e) {
        console.error("Barcode error:", e);
      }
    }
    if (type === "qr" && qrRef.current) {
      QRCode.toCanvas(qrRef.current, product.sku, {
        width: 100,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      });
    }
  }, [product.sku, type]);

  return (
    <div style={{ width: "60mm", border: "0.5mm solid #ddd", padding: "3mm", boxSizing: "border-box", borderRadius: "3mm", backgroundColor: "#fff" }}
      className="flex flex-col items-center">
      <p style={{ fontSize: "8pt", fontWeight: "bold", textAlign: "center", margin: "0 0 2mm 0", lineHeight: 1.2 }}>
        {product.name}
      </p>
      {product.brand && (
        <p style={{ fontSize: "6pt", color: "#666", margin: "0 0 2mm 0" }}>{product.brand}</p>
      )}
      <div style={{ display: "flex", gap: "4mm", fontSize: "7pt", color: "#444", marginBottom: "2mm" }}>
        {product.size && <span>Talle: <strong>{product.size}</strong></span>}
        {product.color && <span>Color: <strong>{product.color}</strong></span>}
      </div>

      {type === "barcode" ? (
        <svg ref={barcodeRef} style={{ maxWidth: "100%" }} />
      ) : (
        <canvas ref={qrRef} style={{ maxWidth: "100%" }} />
      )}

      {product.price && (
        <p style={{ fontSize: "10pt", fontWeight: "bold", margin: "2mm 0 0 0", color: "#000" }}>
          ${Number(product.price).toLocaleString("es-AR")}
        </p>
      )}
    </div>
  );
}