import { useState } from 'react';
import { Eye, EyeOff, Link as LinkIcon, CheckCircle, AlertTriangle, FileText, Image as ImageIcon, FolderOpen, ExternalLink } from 'lucide-react';
import { isValidDriveUrl, extractDriveId, getDrivePreviewUrl } from '../utils/imageUtils';
import DriveImage from './DriveImage';

interface DriveImageInputProps {
  value: string;
  onChange: (val: string) => void;
  label: string;
  placeholder?: string;
  fileType?: 'image' | 'pdf';
  onFileTypeChange?: (type: 'image' | 'pdf') => void;
}

export default function DriveImageInput({
  value,
  onChange,
  label,
  placeholder,
  fileType = 'image',
  onFileTypeChange
}: DriveImageInputProps) {
  const [showPreview, setShowPreview] = useState(false);

  const driveId = extractDriveId(value);
  const isValid = isValidDriveUrl(value);
  const pdfPreviewUrl = getDrivePreviewUrl(value);

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
          {label}
        </label>
        
        {/* File Type Toggle */}
        <div style={{ 
          display: 'flex', 
          background: '#F1F5F9', 
          padding: '3px', 
          borderRadius: '10px',
          border: '1px solid #E2E8F0'
        }}>
          <button
            type="button"
            onClick={() => onFileTypeChange?.('image')}
            style={{
              padding: '4px 10px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.7rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: fileType === 'image' ? 'white' : 'transparent',
              color: fileType === 'image' ? '#FF6A01' : '#64748b',
              boxShadow: fileType === 'image' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            <ImageIcon size={12} /> รูปภาพ
          </button>
          <button
            type="button"
            onClick={() => onFileTypeChange?.('pdf')}
            style={{
              padding: '4px 10px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.7rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: fileType === 'pdf' ? 'white' : 'transparent',
              color: fileType === 'pdf' ? '#FF6A01' : '#64748b',
              boxShadow: fileType === 'pdf' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            <FileText size={12} /> PDF
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
            <LinkIcon size={16} />
          </div>
          <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder || (fileType === 'pdf' ? 'วางลิงก์ PDF จาก Google Drive...' : 'วางลิงก์รูปภาพจาก Google Drive...')}
            style={{
              width: '100%', padding: '12px 14px 12px 38px',
              borderRadius: '12px', fontSize: '0.9rem',
              border: value ? (isValid ? '2px solid #22C55E' : '2px solid #EF4444') : '1px solid #E2E8F0',
              background: 'white', transition: 'all 0.3s ease',
              outline: 'none',
            }}
          />
          {value && (
            <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
              {isValid
                ? <CheckCircle size={16} color="#22C55E" />
                : <AlertTriangle size={16} color="#EF4444" />
              }
            </div>
          )}
        </div>
        {value && (
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            style={{
              padding: '0 16px', borderRadius: '12px', border: '1px solid #E2E8F0',
              background: showPreview ? '#FF6A01' : 'white',
              color: showPreview ? 'white' : '#64748b',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '0.8rem', fontWeight: 700, transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
            ดูตัวอย่าง
          </button>
        )}
      </div>

      {/* Helper text & Folder shortcut */}
      <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        {value && driveId ? (
          <div style={{ fontSize: '0.75rem', color: '#22C55E', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle size={12} /> Google Drive {fileType.toUpperCase()} เชื่อมต่อสำเร็จ
          </div>
        ) : (
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            ฝากไฟล์ใน Drive ตั้งค่าแชร์ <em>"ทุกคนที่มีลิงก์มีสิทธิ์ดู"</em> แล้วคัดลอกลิงก์มาวาง
          </div>
        )}
        <a
          href="https://drive.google.com/drive/folders/1aRRX7vJ8ix2WrD_tP8QxV9HRUKgyeK9f"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#EA580C',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 10px',
            background: '#FFF7ED',
            borderRadius: '8px',
            border: '1px solid #FFEDD5',
            transition: 'all 0.2s ease',
          }}
          title="เปิดโฟลเดอร์ Google Drive เก็บรูปภาพข่าวสารของโรงเรียน"
        >
          <FolderOpen size={13} />
          โฟลเดอร์ Drive รูปข่าวโรงเรียน
          <ExternalLink size={11} style={{ opacity: 0.7 }} />
        </a>
      </div>

      {/* Preview Section */}
      {showPreview && value && (
        <div style={{
          marginTop: '12px', borderRadius: '16px', overflow: 'hidden',
          border: '2px solid #FFF7ED', background: '#FAFAFA',
          position: 'relative', 
        }}>
          {fileType === 'image' ? (
            <DriveImage
              src={value}
              alt="preview"
              style={{ width: '100%', maxHeight: '300px', objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <div style={{ height: '400px', width: '100%' }}>
              <iframe
                src={pdfPreviewUrl}
                width="100%"
                height="100%"
                style={{ border: 'none' }}
                title="PDF Preview"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
