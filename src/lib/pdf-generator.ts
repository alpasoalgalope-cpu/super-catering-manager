import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExportPdfOptions {
  mode: 'all' | 'remito' | 'passengers';
  selectedEvent: any;
  selectedCompany: string;
  deliveryTime?: string;
  deliveryPoint?: string;
  units: any[];
  vehicles: any[];
  coordinators: any[];
  onlineOrders: any[];
}

export function generateAndDownloadSalesPdf({
  mode,
  selectedEvent,
  selectedCompany,
  deliveryTime = '22:00',
  deliveryPoint = '',
  units = [],
  vehicles = [],
  coordinators = [],
  onlineOrders = []
}: ExportPdfOptions) {
  const venueName = selectedEvent?.venues?.name || "S/D";
  const showName = selectedEvent?.show_name || "S/D";
  const eventDateStr = selectedEvent?.event_date 
    ? new Date(selectedEvent.event_date + 'T12:00:00').toLocaleDateString('es-AR')
    : "Sin Fecha";
  const dateFileCode = selectedEvent?.event_date?.replace(/-/g, '') || "Fecha";
  const suffix = mode === 'all' ? 'ALL' : mode.toUpperCase();
  const docFileName = `${dateFileCode} - ${venueName} - ${selectedCompany} - ${suffix}.pdf`;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor: [number, number, number] = [15, 23, 42]; // #0f172a
  const accentColor: [number, number, number] = [30, 64, 175]; // #1e40af
  const lightGrayBg: [number, number, number] = [248, 250, 252]; // #f8fafc
  const nowStr = new Date().toLocaleString('es-AR');

  let pageIndex = 0;

  units.forEach((u, unitIdx) => {
    const v = vehicles.find((veh: any) => veh.id === u.vehicle_id);
    const c = coordinators.find((coord: any) => coord.id === u.coordinator_id);
    const vehText = `${v?.internal_name || 'S/D'} ${v?.plate ? `(${v.plate})` : ''}`.trim();
    const coordName = c?.name || 'S/D';
    const coordPhone = c?.phone || 'S/D';
    const solidsTotal = (Number(u.traditional) || 0) + (Number(u.vegetarian) || 0) + (Number(u.vegana) || 0) + (Number(u.sin_tacc) || 0);
    const liquidsTotal = Number(u.water) || 0;

    // Filter online orders for this unit
    const uNameClean = (u.name || '').toLowerCase().trim();
    let unitOrders = onlineOrders.filter((o: any) => {
      const b = (o.bus_identifier || '').toLowerCase().trim();
      if (!b || b === 'n/a' || b === 'micro unico' || b === 'micro 1' || b === 'todos') return true;
      return b === uNameClean || uNameClean.includes(b) || b.includes(uNameClean);
    });

    if (unitOrders.length === 0 && units.length === 1) {
      unitOrders = onlineOrders;
    }

    // --- RENDER REMITO PAGE ---
    if (mode === 'remito' || mode === 'all') {
      if (pageIndex > 0) doc.addPage();
      pageIndex++;

      // Header Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(...primaryColor);
      doc.text('REMITO DE DESCARGA POR EMPRESA', 14, 16);

      doc.setFontSize(11);
      doc.setTextColor(...accentColor);
      doc.text(`UNIDAD: ${u.name || `MICRO ${unitIdx + 1}`}`, 14, 23);

      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.6);
      doc.line(14, 26, 196, 26);

      // Info Box (Rounded Rect)
      doc.setFillColor(...lightGrayBg);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.roundedRect(14, 30, 182, 38, 3, 3, 'FD');

      // Left Column Info
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('EMPRESA DE TRANSPORTE', 18, 36);
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(String(selectedCompany || 'S/D'), 18, 41);

      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('VEHÍCULO / PATENTE', 18, 47);
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(String(vehText || 'S/D'), 18, 52);

      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('COORDINADOR / RESPONSABLE', 18, 58);
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(`${coordName} (${coordPhone})`, 18, 63);

      // Right Column Info
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('EVENTO / SHOW', 105, 36);
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(String(showName || 'S/D'), 105, 41);

      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('FECHA Y HORARIO DE DESCARGA', 105, 47);
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(`${eventDateStr} — ${deliveryTime || '22:00'} hs`, 105, 52);

      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('PUNTO DE ENTREGA / VENUE', 105, 58);
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      const delivPt = `${venueName} ${deliveryPoint ? `- ${deliveryPoint}` : ''}`.trim();
      doc.text(delivPt.length > 40 ? delivPt.substring(0, 40) + '...' : delivPt, 105, 63);

      // Table 1: Solids
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text('1. DETALLE DE VIANDAS (SÓLIDOS)', 14, 76);

      autoTable(doc, {
        startY: 79,
        head: [['TIPO DE MENÚ', 'CANTIDAD']],
        body: [
          ['Menú Tradicional', String(u.traditional || 0)],
          ['Menú Vegetariano', String(u.vegetarian || 0)],
          ['Menú Vegano', String(u.vegana || 0)],
          ['Menú Sin TACC', String(u.sin_tacc || 0)],
          ['TOTAL SANDWICHES', String(solidsTotal)]
        ],
        theme: 'grid',
        headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, cellPadding: 3 },
        bodyStyles: { fontSize: 9, fontStyle: 'bold', textColor: [0, 0, 0], cellPadding: 2.5 },
        columnStyles: {
          0: { cellWidth: 140 },
          1: { cellWidth: 42, halign: 'right' }
        },
        didParseCell: function(data: any) {
          if (data.row.index === 4) {
            data.cell.styles.fillColor = [226, 232, 240];
            data.cell.styles.fontSize = 10;
            data.cell.styles.fontStyle = 'bold';
            if (data.column.index === 1) {
              data.cell.styles.fillColor = primaryColor;
              data.cell.styles.textColor = [255, 255, 255];
            }
          }
        },
        margin: { left: 14, right: 14 }
      });

      // Table 2: Liquids
      const table1Bottom = ((doc as any).lastAutoTable?.finalY || 120) + 7;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text('2. DETALLE DE BEBIDAS (LÍQUIDOS)', 14, table1Bottom);

      autoTable(doc, {
        startY: table1Bottom + 3,
        head: [['TIPO DE BEBIDA', 'CANTIDAD']],
        body: [
          ['Agua Mineral Sin Gas (500ml)', String(liquidsTotal)],
          ['TOTAL BEBIDAS', String(liquidsTotal)]
        ],
        theme: 'grid',
        headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, cellPadding: 3 },
        bodyStyles: { fontSize: 9, fontStyle: 'bold', textColor: [0, 0, 0], cellPadding: 2.5 },
        columnStyles: {
          0: { cellWidth: 140 },
          1: { cellWidth: 42, halign: 'right' }
        },
        didParseCell: function(data: any) {
          if (data.row.index === 1) {
            data.cell.styles.fillColor = [226, 232, 240];
            data.cell.styles.fontSize = 10;
            data.cell.styles.fontStyle = 'bold';
            if (data.column.index === 1) {
              data.cell.styles.fillColor = primaryColor;
              data.cell.styles.textColor = [255, 255, 255];
            }
          }
        },
        margin: { left: 14, right: 14 }
      });

      // Observations Box
      const table2Bottom = ((doc as any).lastAutoTable?.finalY || 165) + 7;
      doc.setFillColor(...lightGrayBg);
      doc.setDrawColor(0, 0, 0);
      doc.setLineDashPattern([2, 2], 0);
      doc.roundedRect(14, table2Bottom, 182, 24, 2, 2, 'FD');
      doc.setLineDashPattern([], 0);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text('OBSERVACIONES OPERATIVAS:', 18, table2Bottom + 6);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      const obsContent = u.observations || (unitOrders.length > 0 ? `Importado de Tienda Online (${unitOrders.length} pedidos pagados)` : 'Sin observaciones especiales...');
      doc.text(obsContent, 18, table2Bottom + 13);

      // Footer
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.setDrawColor(203, 213, 225);
      doc.line(14, 282, 196, 282);
      doc.text(`Remito Oficial de Descarga — Super Catering Manager — Generado: ${nowStr}`, 105, 287, { align: 'center' });
    }

    // --- RENDER PASSENGERS PAGE ---
    if ((mode === 'passengers' || mode === 'all') && (unitOrders.length > 0 || mode === 'passengers')) {
      if (pageIndex > 0) doc.addPage();
      pageIndex++;

      // Header Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(17);
      doc.setTextColor(...accentColor);
      doc.text('PLANILLA DE PASAJEROS — ENTREGA EN MICRO', 14, 16);

      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(`Unidad: ${u.name || `MICRO ${unitIdx + 1}`} | Total: ${unitOrders.length} Pasajeros con Vianda Pagada`, 14, 23);

      doc.setDrawColor(...accentColor);
      doc.setLineWidth(0.6);
      doc.line(14, 26, 196, 26);

      // Info strip
      doc.setFillColor(...lightGrayBg);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.roundedRect(14, 29, 182, 14, 2, 2, 'FD');

      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(`EMPRESA: ${selectedCompany}`, 18, 35);
      doc.text(`EVENTO: ${showName} (${eventDateStr})`, 18, 40);
      doc.text(`RESPONSABLE: ${coordName} (${coordPhone})`, 110, 35);
      doc.text(`VEHÍCULO: ${vehText}`, 110, 40);

      // Notice
      doc.setFontSize(7.5);
      doc.setTextColor(...accentColor);
      doc.text('* CONTROL NOMINAL OBLIGATORIO: TILDAR CASILLA AL ENTREGAR CADA VIANDA ARRIBA DEL MICRO.', 14, 48);

      const tableRows = unitOrders.map((ord: any, ordIdx: number) => {
        const items = [];
        if (ord.qty_tradicional > 0) items.push(`${ord.qty_tradicional}x Trad`);
        if (ord.qty_vegetariano > 0) items.push(`${ord.qty_vegetariano}x Veg`);
        if (ord.qty_sintacc > 0) items.push(`${ord.qty_sintacc}x Sin TACC`);
        if (ord.qty_vegano > 0) items.push(`${ord.qty_vegano}x Vegano`);
        const comboText = items.join(', ') || '1x Vianda';
        const name = (ord.online_customers?.full_name || ord.full_name || 'PASAJERO ONLINE').toUpperCase();
        const phone = ord.online_customers?.phone || ord.phone || 'S/D';

        return [
          String(ordIdx + 1),
          name,
          phone,
          comboText,
          '[    ]'
        ];
      });

      autoTable(doc, {
        startY: 51,
        head: [['#', 'NOMBRE Y APELLIDO', 'TELÉFONO', 'DETALLE DE COMBOS', 'ENTREGADO']],
        body: tableRows.length > 0 ? tableRows : [['-', 'SIN PASAJEROS REGISTRADOS', '-', '-', '-']],
        theme: 'grid',
        headStyles: { fillColor: accentColor, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, cellPadding: 2.5 },
        bodyStyles: { fontSize: 8, fontStyle: 'bold', textColor: [15, 23, 42], cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 55 },
          2: { cellWidth: 35 },
          3: { cellWidth: 62 },
          4: { cellWidth: 20, halign: 'center' }
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 }
      });

      // Footer
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.setDrawColor(203, 213, 225);
      doc.line(14, 282, 196, 282);
      doc.text(`Planilla de Pasajeros — Super Catering Manager — Generado: ${nowStr}`, 105, 287, { align: 'center' });
    }
  });

  // Direct instant download trigger!
  doc.save(docFileName);
}
