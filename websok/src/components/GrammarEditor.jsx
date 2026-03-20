// GrammarEditor — grammar textarea with syntax-highlighted preview
// The textarea captures input; a highlighted <pre> below shows the parsed rendering.

import { useRef, useCallback } from 'react';
import { highlightTokens, TOKEN_CSS_CLASSES } from '../soko/highlight.js';
import './GrammarEditor.css';

export default function GrammarEditor({ value, onChange }) {
    const textareaRef = useRef(null);

    // Render syntax-highlighted preview from parsed AST
    const tokens = highlightTokens(value || '');
    const highlighted = tokens.map((token, i) => {
        const cls = TOKEN_CSS_CLASSES[token.type] || 'sok-text';
        return <span key={i} className={cls}>{token.text}</span>;
    });

    return (
        <div className="grammar-editor">
            <textarea
                ref={textareaRef}
                className="grammar-editor-textarea"
                value={value}
                onChange={onChange}
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
            />
            <pre className="grammar-editor-preview">{highlighted}</pre>
        </div>
    );
}
