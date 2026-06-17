import fs from 'fs';

const filePath = 'c:/Users/blust/sentinel/src/pages/Memory.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add ArrowRightLeft to lucide-react import
if (!content.includes('ArrowRightLeft')) {
  content = content.replace(
    /import \{\n([\s\S]*?)\} from 'lucide-react';/,
    (match, p1) => \`import {\\n\${p1}  ArrowRightLeft,\\n} from 'lucide-react';\`
  );
}

// 2. Remove old Tab Switcher
const oldSwitcher = \`        {/* Tab Switcher */}
        <div style={{ display: 'flex', background: '#111', padding: '4px', borderRadius: '24px', border: '1px solid #222' }}>
          <button
            onClick={() => setActiveTab('incidents')}
            style={{
              padding: '6px 16px',
              borderRadius: '20px',
              border: 'none',
              background: activeTab === 'incidents' ? '#222' : 'transparent',
              color: activeTab === 'incidents' ? '#fff' : '#888',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Incidents
          </button>
          <button
            onClick={() => setActiveTab('agent')}
            style={{
              padding: '6px 16px',
              borderRadius: '20px',
              border: 'none',
              background: activeTab === 'agent' ? '#222' : 'transparent',
              color: activeTab === 'agent' ? '#fff' : '#888',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Agent Conversations
          </button>
        </div>\`;

content = content.replace(oldSwitcher, '');

// 3. Add new Tab Switcher next to search bar
const newSwitcher = \`        {/* Tab Switcher */}
        <button
          onClick={() => setActiveTab(prev => prev === 'incidents' ? 'agent' : 'incidents')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '20px',
            background: 'rgba(139, 92, 246, 0.08)',
            border: '1px solid rgba(139, 92, 246, 0.2)',
            color: '#8b5cf6',
            cursor: 'pointer',
            transition: 'all 0.2s',
            flexShrink: 0,
            fontSize: '12px',
            fontWeight: 600,
          }}
          title="Toggle Memory View"
        >
          <ArrowRightLeft size={14} />
          <span>{activeTab === 'incidents' ? 'Incidents' : 'Agent Convos'}</span>
        </button>\`;

// Insert it right after the Search div
content = content.replace(
  \`          />
        </div>\`,
  \`          />
        </div>

\${newSwitcher}\`
);

fs.writeFileSync(filePath, content);
console.log('Done replacing Memory.tsx');
