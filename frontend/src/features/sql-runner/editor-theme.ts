/**
 * Подсветка синтаксиса в редакторе через токены приложения.
 *
 * Готовые темы CodeMirror задают цвета абсолютными значениями и рассчитаны на свой фон:
 * на нашей тёмной подложке ключевые слова оказывались темнее обычного текста. Здесь цвета
 * берутся из тех же CSS-переменных, что и весь интерфейс, поэтому обе темы согласованы,
 * а сменить палитру можно правкой одного index.css.
 */

import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import { tags } from '@lezer/highlight'

const highlightStyle = HighlightStyle.define([
  { tag: [tags.keyword, tags.operatorKeyword, tags.modifier], color: 'var(--gym-accent)', fontWeight: '600' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--gym-success)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--gym-warning)' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: 'var(--gym-muted)', fontStyle: 'italic' },
  { tag: [tags.function(tags.variableName), tags.standard(tags.variableName)], color: 'var(--gym-danger)' },
  { tag: [tags.variableName, tags.propertyName, tags.typeName], color: 'var(--gym-text)' },
  { tag: [tags.operator, tags.punctuation], color: 'var(--gym-muted)' },
])

export const editorTheme: Extension = syntaxHighlighting(highlightStyle)
