import { useState, useMemo, useEffect } from 'react';
import { X, ClipboardPaste, Check, AlertCircle, Trash2, ShieldAlert } from 'lucide-react';
import { parseClipboardTable, cleanNumeric, isLikelyHeaderRow, matchPastedRowsToStudents } from '../utils/excelPaste';

export interface ColumnOption {
  key: string;
  label: string;
  unit?: string;
  min?: number;
  max?: number;
  placeholder?: string;
}

export interface PasteStudentRow {
  id: string;
  code?: string;
  name: string;
  currentValues: Record<string, number | string | null | undefined>;
}

export interface ExcelPasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  themeColor?: string;
  students: PasteStudentRow[];
  columns: ColumnOption[];
  onApply: (records: Array<{ studentId: string; values: Record<string, number | null> }>) => Promise<void> | void;
}

export default function ExcelPasteModal({
  isOpen,
  onClose,
  title = '📋 วางข้อมูลจาก Excel / Google Sheets',
  subtitle = 'คัดลอกเซลล์ใน Excel/Sheets แล้วนำมากดวาง (Ctrl+V) ในช่องด้านล่าง',
  themeColor = '#FF6A01',
  students,
  columns,
  onApply,
}: ExcelPasteModalProps) {
  const [rawText, setRawText] = useState('');
  const [mappingMode, setMappingMode] = useState<string>('all');
  const [skipFirstRow, setSkipFirstRow] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Parse clipboard text whenever rawText changes
  const parsedTable = useMemo(() => {
    return parseClipboardTable(rawText);
  }, [rawText]);

  // Detect if the first row is likely a header (e.g. "น้ำหนัก", "ส่วนสูง")
  const detectedHeader = useMemo(() => {
    return isLikelyHeaderRow(parsedTable);
  }, [parsedTable]);

  // Automatically enable skipFirstRow when a header row is detected
  useEffect(() => {
    setSkipFirstRow(detectedHeader);
  }, [detectedHeader]);

  // Effective table data after header skipping
  const effectiveTable = useMemo(() => {
    return skipFirstRow ? parsedTable.slice(1) : parsedTable;
  }, [parsedTable, skipFirstRow]);

  // Smart matching by student code when in 'all' mode
  const smartMatches = useMemo(() => {
    if (mappingMode !== 'all' || effectiveTable.length === 0) return null;
    return matchPastedRowsToStudents(effectiveTable, students, columns);
  }, [effectiveTable, students, columns, mappingMode]);

  const isSmartCodeMatched = useMemo(() => {
    return smartMatches ? smartMatches.some(m => m.matchType === 'code') : false;
  }, [smartMatches]);

  // Auto-detect mode if multiple columns pasted
  const detectedCols = effectiveTable.length > 0 ? Math.max(...effectiveTable.map(r => r.length)) : 0;

  // Build mapping for each student
  const previewData = useMemo(() => {
    const smartMap = smartMatches ? new Map(smartMatches.map(m => [m.studentId, m])) : null;

    return students.map((student, idx) => {
      const smartRow = smartMap?.get(student.id);
      let newValues: Record<string, number | null> = {};
      let hasChanges = false;
      let hasData = false;
      const warnings: string[] = smartRow?.warnings ? [...smartRow.warnings] : [];

      if (smartRow) {
        newValues = smartRow.values;
        hasData = Object.values(newValues).some(v => v !== null);
        columns.forEach(col => {
          const val = newValues[col.key];
          const cur = student.currentValues[col.key];
          const curNum = cur === '' || cur === undefined || cur === null ? null : Number(cur);
          if (val !== undefined && val !== curNum && (val !== null || curNum !== null)) {
            hasChanges = true;
          }
        });
      } else {
        const row = effectiveTable[idx];
        if (row && row.length > 0) {
          if (mappingMode === 'all') {
            columns.forEach((col, colIdx) => {
              if (colIdx < row.length) {
                const val = cleanNumeric(row[colIdx]);
                newValues[col.key] = val;
                if (val !== null) {
                  if (col.min !== undefined && val < col.min) warnings.push(`${col.label} ต่ำกว่าเกณฑ์ (${val} < ${col.min})`);
                  if (col.max !== undefined && val > col.max) warnings.push(`${col.label} เกินเกณฑ์สูงสุด (${val} > ${col.max})`);
                }
                const cur = student.currentValues[col.key];
                const curNum = cur === '' || cur === undefined || cur === null ? null : Number(cur);
                if (val !== curNum && (val !== null || curNum !== null)) {
                  hasChanges = true;
                }
              }
            });
          } else {
            const val = cleanNumeric(row[0]);
            newValues[mappingMode] = val;
            const targetCol = columns.find(c => c.key === mappingMode);
            if (val !== null && targetCol) {
              if (targetCol.min !== undefined && val < targetCol.min) warnings.push(`${targetCol.label} ต่ำกว่าเกณฑ์ (${val} < ${targetCol.min})`);
              if (targetCol.max !== undefined && val > targetCol.max) warnings.push(`${targetCol.label} เกินเกณฑ์สูงสุด (${val} > ${targetCol.max})`);
            }
            const cur = student.currentValues[mappingMode];
            const curNum = cur === '' || cur === undefined || cur === null ? null : Number(cur);
            if (val !== curNum && (val !== null || curNum !== null)) {
              hasChanges = true;
            }
          }
          hasData = !!(row.some(cell => cell.trim() !== ''));
        }
      }

      return {
        student,
        rowNumber: idx + 1,
        newValues,
        hasChanges,
        hasData,
        warnings,
      };
    });
  }, [students, effectiveTable, mappingMode, columns, smartMatches]);

  const updatedCount = previewData.filter(p => p.hasData).length;

  const handleConfirm = async () => {
    if (updatedCount === 0) return;
    setIsSubmitting(true);
    try {
      const payload = previewData
        .filter(p => p.hasData)
        .map(p => ({
          studentId: p.student.id,
          values: p.newValues,
        }));
      await onApply(payload);
      setRawText('');
      onClose();
    } catch (err) {
      console.error('Batch paste save failed', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#FFFFFF',
          borderRadius: 16,
          maxWidth: 960,
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          animation: 'modalSlideUp 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(to right, #F8FAFC, #FFFFFF)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: `${themeColor}15`,
                color: themeColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ClipboardPaste size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>
                {title}
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B' }}>
                {subtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#F1F5F9',
              border: 'none',
              borderRadius: 8,
              width: 34,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748B',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Mapping Controls if multiple columns */}
          {columns.length > 1 && (
            <div
              style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 10,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                <span>🎯 รูปแบบการนำเข้าคอลัมน์:</span>
                <select
                  value={mappingMode}
                  onChange={e => setMappingMode(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    background: 'white',
                    color: '#0F172A',
                    cursor: 'pointer',
                  }}
                >
                  <option value="all">
                    นำเข้าทุกคอลัมน์พร้อมกัน ({columns.map(c => c.label).join(' + ')})
                  </option>
                  {columns.map(col => (
                    <option key={col.key} value={col.key}>
                      เฉพาะ: {col.label} (1 คอลัมน์)
                    </option>
                  ))}
                </select>
              </div>

              {isSmartCodeMatched && (
                <span style={{ fontSize: '0.78rem', color: '#15803D', background: '#DCFCE7', border: '1px solid #86EFAC', padding: '3px 10px', borderRadius: 999, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Check size={13} /> ตรวจพบรหัสนักเรียน (Smart Match อัตโนมัติ)
                </span>
              )}

              {detectedCols > 0 && (
                <span style={{ fontSize: '0.78rem', color: '#64748B', background: '#E2E8F0', padding: '3px 8px', borderRadius: 999 }}>
                  ตรวจพบในคลิปบอร์ด: {detectedCols} คอลัมน์ ({parsedTable.length} แถว)
                </span>
              )}
            </div>
          )}

          {/* Paste Textarea */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1E293B' }}>
                1. วางข้อมูลจากคลิปบอร์ดที่นี่ (กดคลิกแล้วกด Ctrl+V):
              </label>
              {rawText && (
                <button
                  onClick={() => setRawText('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#EF4444',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Trash2 size={13} /> ล้างข้อมูลที่วาง
                </button>
              )}
            </div>

            <textarea
              rows={4}
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder={`ตัวอย่างเช่น คัดลอกเซลล์ตัวเลขจาก Excel แล้วกด Ctrl+V ที่นี่...\n45.5\t155.0\n52.0\t162.0\n38.2\t142.5`}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 14px',
                borderRadius: 10,
                border: `2px dashed ${rawText ? themeColor : '#CBD5E1'}`,
                backgroundColor: rawText ? '#FEFCE8' : '#F8FAFC',
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                lineHeight: 1.4,
                color: '#0F172A',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Instruction helper */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.78rem', color: '#64748B' }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1, color: themeColor }} />
            <span>
              แถวที่ 1 จะตรงกับนักเรียนเลขที่ 1, แถวที่ 2 ตรงกับเลขที่ 2 ตามลำดับรายชื่อห้องเรียน (รองรับตัวเลขที่มีคอมม่า เช่น 1,200 หรือขีด -)
            </span>
          </div>

          {/* Header Detection Alert */}
          {detectedHeader && (
            <div
              style={{
                background: '#FEF3C7',
                border: '1px solid #F59E0B',
                borderRadius: 8,
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
                fontSize: '0.82rem',
                color: '#92400E',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>⚠️ ตรวจพบแถวหัวตาราง:</span>
                <span style={{ fontWeight: 700 }}>
                  "{parsedTable[0]?.slice(0, 3).join(' | ')}"
                </span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={skipFirstRow}
                  onChange={e => setSkipFirstRow(e.target.checked)}
                />
                ข้ามแถวแรก (ไม่นำเข้าหัวตาราง)
              </label>
            </div>
          )}

          {/* Row count mismatch notice */}
          {effectiveTable.length > students.length && (
            <div
              style={{
                background: '#EFF6FF',
                border: '1px solid #93C5FD',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: '0.8rem',
                color: '#1E40AF',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              ℹ️ ข้อมูลที่วางมี {effectiveTable.length} แถว ซึ่งมากกว่าจำนวนนักเรียน ({students.length} คน) ระบบจะนำเข้าเฉพาะ {students.length} คนแรกตามลำดับ
            </div>
          )}

          {/* Live Preview Section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0F172A' }}>
                2. ตรวจสอบข้อมูลก่อนบันทึก ({students.length} คนในห้อง)
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                {updatedCount > 0 ? (
                  <span style={{ color: '#16A34A', background: '#DCFCE7', padding: '3px 10px', borderRadius: 999 }}>
                    ✓ พบข้อมูลพร้อมอัปเดต {updatedCount} คน
                  </span>
                ) : (
                  <span style={{ color: '#94A3B8' }}>ยังไม่มีข้อมูลที่วาง</span>
                )}
              </div>
            </div>

            <div
              style={{
                border: '1px solid #E2E8F0',
                borderRadius: 10,
                overflow: 'hidden',
                maxHeight: 280,
                overflowY: 'auto',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#F1F5F9', color: '#475569', position: 'sticky', top: 0, zIndex: 1 }}>
                    <th style={{ padding: '8px 10px', textAlign: 'center', width: 40 }}>#</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: 160 }}>ชื่อนักเรียน</th>
                    {columns.map(col => {
                      const isMapped = mappingMode === 'all' || mappingMode === col.key;
                      return (
                        <th
                          key={col.key}
                          style={{
                            padding: '8px 10px',
                            textAlign: 'center',
                            opacity: isMapped ? 1 : 0.45,
                            background: isMapped ? '#F1F5F9' : '#E2E8F0',
                          }}
                        >
                          {col.label} {col.unit ? `(${col.unit})` : ''}
                        </th>
                      );
                    })}
                    <th style={{ padding: '8px 10px', textAlign: 'center', width: 100 }}>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((item, i) => {
                    return (
                      <tr
                        key={item.student.id}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          background: item.hasData
                            ? '#F0FDF4'
                            : i % 2
                            ? '#FFFFFF'
                            : '#F8FAFC',
                        }}
                      >
                        <td style={{ padding: '6px 10px', textAlign: 'center', color: '#64748B' }}>
                          {i + 1}
                        </td>
                        <td style={{ padding: '6px 10px', fontWeight: 600, color: '#1E293B' }}>
                          <div>{item.student.name}</div>
                          {item.student.code && (
                            <span style={{ fontSize: '0.72rem', color: '#64748B', fontFamily: 'monospace' }}>
                              รหัส: {item.student.code}
                            </span>
                          )}
                          {item.warnings.length > 0 && (
                            <div style={{ fontSize: '0.72rem', color: '#DC2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                              <ShieldAlert size={12} /> {item.warnings.join(' • ')}
                            </div>
                          )}
                        </td>
                        {columns.map(col => {
                          const isMapped = mappingMode === 'all' || mappingMode === col.key;
                          const currentVal = item.student.currentValues[col.key];
                          const newVal = item.newValues[col.key];
                          const isChanged = item.hasData && isMapped && newVal !== undefined;

                          return (
                            <td key={col.key} style={{ padding: '6px 10px', textAlign: 'center' }}>
                              {isChanged ? (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  {currentVal !== undefined && currentVal !== null && currentVal !== '' && (
                                    <span style={{ color: '#94A3B8', textDecoration: 'line-through', fontSize: '0.75rem' }}>
                                      {String(currentVal)}
                                    </span>
                                  )}
                                  <span style={{ fontWeight: 800, color: themeColor, background: '#FFF', padding: '1px 6px', borderRadius: 4, border: `1px solid ${themeColor}40` }}>
                                    {newVal !== null ? newVal : '-'}
                                  </span>
                                </div>
                              ) : (
                                <span style={{ color: '#64748B' }}>
                                  {currentVal !== undefined && currentVal !== null && currentVal !== '' ? String(currentVal) : '-'}
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                          {item.warnings.length > 0 ? (
                            <span style={{ fontSize: '0.72rem', color: '#DC2626', fontWeight: 700, background: '#FEE2E2', border: '1px solid #FCA5A5', padding: '2px 8px', borderRadius: 999 }}>
                              ⚠️ เกินเกณฑ์
                            </span>
                          ) : item.hasData ? (
                            <span style={{ fontSize: '0.72rem', color: '#16A34A', fontWeight: 700, background: '#DCFCE7', padding: '2px 8px', borderRadius: 999 }}>
                              จะอัปเดต
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                              คงเดิม
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#F8FAFC',
          }}
        >
          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#475569',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ยกเลิก
          </button>

          <button
            onClick={handleConfirm}
            disabled={updatedCount === 0 || isSubmitting}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              border: 'none',
              background: themeColor,
              color: '#FFFFFF',
              fontSize: '0.88rem',
              fontWeight: 800,
              cursor: updatedCount === 0 || isSubmitting ? 'not-allowed' : 'pointer',
              opacity: updatedCount === 0 || isSubmitting ? 0.5 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            {isSubmitting ? (
              <span>กำลังบันทึก...</span>
            ) : (
              <>
                <Check size={16} /> ยืนยันและบันทึก ({updatedCount} คน)
              </>
            )}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes modalSlideUp {
          from { transform: translateY(16px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
