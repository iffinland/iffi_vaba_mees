import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import {
  MAX_BLOG_TAG_LENGTH,
  normalizeTagForComparison,
} from '../../../utils/tagNormalizer';
import styles from './TagInput.module.css';

/**
 * Rank suggestions: prefix matches first, then substring, preserve canonical display.
 * Limit visible list to maxVisible (default 8).
 */
const rankAndLimitSuggestions = (suggestions, query, maxVisible = 8) => {
  if (!query) return suggestions.slice(0, maxVisible);

  const normalizedQuery = normalizeTagForComparison(query);
  const prefix = [];
  const substring = [];

  for (const item of suggestions) {
    if (item.normalized.startsWith(normalizedQuery)) {
      prefix.push(item);
    } else if (item.normalized.includes(normalizedQuery)) {
      substring.push(item);
    }
  }

  return [...prefix, ...substring].slice(0, maxVisible);
};

/**
 * TagInput — reusable autocomplete tag input.
 *
 * Props:
 *   value: string[]           — currently selected tags (display values)
 *   suggestions: { display: string, normalized: string }[] — available tag inventory
 *   onChange: (tags: string[]) => void
 *   placeholder?: string
 *   disabled?: boolean
 *   maxTags?: number          — default 12
 *   maxTagLength?: number     — default 80
 */
function TagInput({
  value = [],
  suggestions = [],
  onChange,
  placeholder = 'Add a tag…',
  disabled = false,
  maxTags = 12,
  maxTagLength = MAX_BLOG_TAG_LENGTH,
}) {
  const [inputText, setInputText] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selectedNormMap = useMemo(() => {
    const map = new Map();
    for (const tag of value) {
      map.set(normalizeTagForComparison(tag), tag);
    }
    return map;
  }, [value]);

  // Filter suggestions: remove already-selected tags
  const filteredSuggestions = useMemo(() => {
    if (!inputText.trim()) {
      // Show all unselected tags when focused and empty
      return suggestions.filter((s) => !selectedNormMap.has(s.normalized));
    }
    return rankAndLimitSuggestions(
      suggestions.filter((s) => !selectedNormMap.has(s.normalized)),
      inputText,
      8,
    );
  }, [suggestions, selectedNormMap, inputText]);

  // Check if the normalized input creates a genuinely new tag
  const canCreateNew = useMemo(() => {
    const normalized = normalizeTagForComparison(inputText);
    if (!normalized) return false;
    if (normalized.length > maxTagLength) return false;
    // Check against existing suggestions
    const exists = suggestions.some((s) => s.normalized === normalized);
    if (exists) return false;
    // Check against already selected
    if (selectedNormMap.has(normalized)) return false;
    return true;
  }, [inputText, suggestions, selectedNormMap, maxTagLength]);

  // Reset active index when suggestions change
  useEffect(() => {
    setActiveIndex(-1);
  }, [filteredSuggestions.length]);

  const addTag = useCallback(
    (display) => {
      const trimmed = display.trim().replace(/\s+/g, ' ');
      if (!trimmed) return;
      if (trimmed.length > maxTagLength) return;

      const normalized = normalizeTagForComparison(trimmed);

      // Already selected?
      if (selectedNormMap.has(normalized)) {
        setInputText('');
        return;
      }

      // At max tags?
      if (value.length >= maxTags) {
        setInputText('');
        return;
      }

      // Find canonical display from suggestions
      const existingSuggestion = suggestions.find((s) => s.normalized === normalized);
      const finalDisplay = existingSuggestion ? existingSuggestion.display : trimmed;

      onChange([...value, finalDisplay]);
      setInputText('');
      setActiveIndex(-1);
    },
    [value, onChange, selectedNormMap, suggestions, maxTags, maxTagLength],
  );

  const removeTag = useCallback(
    (index) => {
      const next = [...value];
      next.splice(index, 1);
      onChange(next);
      inputRef.current?.focus();
    },
    [value, onChange],
  );

  const handleInputChange = (event) => {
    // Don't allow commas — they trigger tag creation
    const raw = event.target.value;
    if (raw.includes(',')) {
      // Split by comma, add each part as a tag
      const parts = raw.split(',');
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed) addTag(trimmed);
      }
      return;
    }
    setInputText(raw);
  };

  const handleKeyDown = (event) => {
    const listLength = filteredSuggestions.length + (canCreateNew ? 1 : 0);

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((prev) => {
          if (prev >= listLength - 1) return 0;
          return prev + 1;
        });
        break;

      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((prev) => {
          if (prev <= 0) return listLength - 1;
          return prev - 1;
        });
        break;

      case 'Enter':
        event.preventDefault();
        if (activeIndex >= 0) {
          // Select from list
          if (activeIndex < filteredSuggestions.length) {
            addTag(filteredSuggestions[activeIndex].display);
          } else if (canCreateNew) {
            addTag(inputText);
          }
        } else if (inputText.trim()) {
          addTag(inputText);
        }
        break;

      case 'Escape':
        event.preventDefault();
        setInputText('');
        setActiveIndex(-1);
        inputRef.current?.blur();
        break;

      case 'Backspace':
        if (!inputText && value.length > 0) {
          removeTag(value.length - 1);
        }
        break;

      default:
        break;
    }
  };

  const handleSuggestionClick = (suggestion) => {
    addTag(suggestion.display);
    inputRef.current?.focus();
  };

  const handleCreateClick = () => {
    addTag(inputText);
    inputRef.current?.focus();
  };

  const handleWrapperClick = () => {
    inputRef.current?.focus();
  };

  // Scroll active suggestion into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const items = listRef.current.children;
    if (items[activeIndex]) {
      items[activeIndex].scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const showSuggestions = isFocused && (filteredSuggestions.length > 0 || canCreateNew);

  return (
    <div>
      <div
        ref={wrapperRef}
        className={`${styles.wrapper} ${disabled ? styles.wrapperDisabled : ''}`}
        onClick={disabled ? undefined : handleWrapperClick}
        role="combobox"
        aria-expanded={showSuggestions}
        aria-haspopup="listbox"
      >
        {value.map((tag, index) => (
          <span key={`${normalizeTagForComparison(tag)}-${index}`} className={styles.chip}>
            {tag}
            {!disabled && (
              <button
                type="button"
                className={styles.chipRemove}
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(index);
                }}
                aria-label={`Remove tag ${tag}`}
                tabIndex={-1}
              >
                <FaTimes size={10} />
              </button>
            )}
          </span>
        ))}

        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            // Delay to allow click on suggestion
            window.setTimeout(() => setIsFocused(false), 150);
          }}
          placeholder={value.length === 0 ? placeholder : ''}
          disabled={disabled}
          aria-label="Add a tag"
          aria-autocomplete="list"
        />
      </div>

      {showSuggestions && (
        <div style={{ position: 'relative' }}>
          <ul ref={listRef} className={styles.suggestions} role="listbox">
            {filteredSuggestions.map((suggestion, index) => (
              <li
                key={suggestion.normalized}
                role="option"
                aria-selected={index === activeIndex}
                className={`${styles.suggestionItem} ${index === activeIndex ? styles.suggestionActive : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent blur
                  handleSuggestionClick(suggestion);
                }}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span className={styles.suggestionMatch}>{suggestion.display}</span>
              </li>
            ))}

            {canCreateNew && (
              <li
                role="option"
                aria-selected={activeIndex === filteredSuggestions.length}
                className={`${styles.suggestionItem} ${styles.createOption} ${activeIndex === filteredSuggestions.length ? styles.suggestionActive : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleCreateClick();
                }}
                onMouseEnter={() => setActiveIndex(filteredSuggestions.length)}
              >
                Create tag{' '}
                <span className={styles.createLabel}>
                  &ldquo;{inputText.trim().replace(/\s+/g, ' ')}&rdquo;
                </span>
              </li>
            )}
          </ul>
        </div>
      )}

      {!disabled && (
        <div className={styles.hint}>
          Separate tags with commas or press Enter.
        </div>
      )}
    </div>
  );
}

export default TagInput;
