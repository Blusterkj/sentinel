import fs from 'fs';

const filePath = 'c:/Users/blust/sentinel/src/pages/Memory.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add SeverityBadge import
if (!content.includes("import { SeverityBadge }")) {
  content = content.replace(
    `import { PROXY_URL } from '../lib/api';`,
    `import { PROXY_URL } from '../lib/api';\nimport { SeverityBadge } from '../components/SeverityBadge';`
  );
}

// 2. Add TYPE_ICONS and TYPE_LABELS
const iconsStr = `
const TYPE_ICONS: Record<string, string> = {
  medical: '🏥',
  fire: '🔥',
  crime: '🚨',
  accident: '💥',
  natural_disaster: '🌩️',
  other: '⚠️',
};

const TYPE_LABELS: Record<string, string> = {
  medical: 'Medical Emergency',
  fire: 'Fire',
  crime: 'Crime',
  accident: 'Accident',
  natural_disaster: 'Natural Disaster',
  other: 'Other',
};
`;
if (!content.includes('TYPE_ICONS')) {
  content = content.replace(
    `export const Memory: React.FC<MemoryProps>`,
    `${iconsStr}\nexport const Memory: React.FC<MemoryProps>`
  );
}

// 3. Add rawIncident to mapping
content = content.replace(
  `          timestamp: new Date(i.createdAt || Date.now()).getTime(),
          summary: \`[\${i.severity.toUpperCase()}] \${i.type} at \${i.location.address}: \${i.description}\`,`,
  `          timestamp: new Date(i.createdAt || Date.now()).getTime(),
          summary: \`[\${i.severity.toUpperCase()}] \${i.type} at \${i.location.address}: \${i.description}\`,
          rawIncident: i,`
);

// 4. Update MemoryEntry rendering
const oldMainContent = `{/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Row 1: Title/Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#ddd' }}>Agent Conversation</span>
        </div>

        <p
          style={{
            fontSize: '12px',
            color: '#777',
            lineHeight: '1.4',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
            marginBottom: '6px',
          }}
        >
          {memory.summary}
        </p>`;

const newMainContent = `{/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {memory.type === 'incident' && memory.rawIncident ? (
          <>
            {/* Incident Mode */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <SeverityBadge severity={memory.rawIncident.severity} size="sm" pulse={memory.rawIncident.severity === 'critical'} />
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#ddd' }}>
                {TYPE_LABELS[memory.rawIncident.type] || 'Incident Report'}
              </span>
            </div>
            <p
              style={{
                fontSize: '13px',
                color: '#aaa',
                lineHeight: '1.4',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                marginBottom: '6px',
              }}
            >
              {memory.rawIncident.description}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#666', marginBottom: '8px' }}>
              📍 {memory.rawIncident.location.address}
            </div>
          </>
        ) : (
          <>
            {/* Agent Conversation Mode */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#ddd' }}>Agent Conversation</span>
            </div>
            <p
              style={{
                fontSize: '12px',
                color: '#777',
                lineHeight: '1.4',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '100%',
                marginBottom: '6px',
              }}
            >
              {memory.summary}
            </p>
          </>
        )}`;

content = content.replace(oldMainContent, newMainContent);

// 5. Update Type Icon
const oldTypeIcon = `{/* Type icon */}
      <div
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: '#1a1a1a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          flexShrink: 0,
        }}
      >
        💬
      </div>`;

const newTypeIcon = `{/* Type icon */}
      <div
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: memory.type === 'incident' ? 'rgba(255,255,255,0.03)' : '#1a1a1a',
          border: memory.type === 'incident' ? '1px solid rgba(255,255,255,0.05)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          flexShrink: 0,
        }}
      >
        {memory.type === 'incident' && memory.rawIncident ? TYPE_ICONS[memory.rawIncident.type] || '⚠️' : '💬'}
      </div>`;

content = content.replace(oldTypeIcon, newTypeIcon);

fs.writeFileSync(filePath, content);
console.log('Successfully updated Memory.tsx for incident UI');
