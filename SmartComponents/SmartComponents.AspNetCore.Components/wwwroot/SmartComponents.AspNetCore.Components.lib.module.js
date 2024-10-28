function setFormElementValueWithEvents(elem, value) {
    if (elem instanceof HTMLSelectElement) {
        const valueToString = value.toString();
        const newSelectedIndex = findSelectOptionByText(elem, valueToString);
        if (newSelectedIndex !== null && elem.selectedIndex !== newSelectedIndex) {
            notifyFormElementBeforeWritten(elem);
            elem.selectedIndex = newSelectedIndex;
            notifyFormElementWritten(elem);
        }
    }
    else if (elem instanceof HTMLInputElement && (elem.type === 'radio' || elem.type === 'checkbox')) {
        const valueStringLower = value === null || value === void 0 ? void 0 : value.toString().toLowerCase();
        const shouldCheck = (valueStringLower === "true") || (valueStringLower === "yes") || (valueStringLower === "on");
        if (elem && elem.checked !== shouldCheck) {
            notifyFormElementBeforeWritten(elem);
            elem.checked = shouldCheck;
            notifyFormElementWritten(elem);
        }
    }
    else {
        if (isComboBox(elem)) {
            // TODO: Support datalist by interpreting it as a set of allowed values. When populating
            // the form, only accept suggestions that match one of the allowed values.
            return;
        }
        value = value.toString();
        if (elem.value !== value) {
            notifyFormElementBeforeWritten(elem);
            elem.value = value;
            notifyFormElementWritten(elem);
        }
    }
}
function isComboBox(elem) {
    return !!(elem.list || elem.getAttribute('data-autocomplete'));
}
// Client-side code (e.g., validation) may react when an element value is changed
// We'll trigger the same kinds of events that fire if you type
function notifyFormElementBeforeWritten(elem) {
    elem.dispatchEvent(new CustomEvent('beforeinput', { bubbles: true, detail: { fromSmartComponents: true } }));
}
function notifyFormElementWritten(elem) {
    elem.dispatchEvent(new CustomEvent('input', { bubbles: true, detail: { fromSmartComponents: true } }));
    elem.dispatchEvent(new CustomEvent('change', { bubbles: true, detail: { fromSmartComponents: true } }));
}
function findSelectOptionByText(selectElem, valueText) {
    const options = Array.from(selectElem.querySelectorAll('option'));
    const exactMatches = options.filter(o => o.textContent === valueText);
    if (exactMatches.length > 0) {
        return options.indexOf(exactMatches[0]);
    }
    const partialMatches = options.filter(o => o.textContent && o.textContent.indexOf(valueText) >= 0);
    if (partialMatches.length === 1) {
        return options.indexOf(partialMatches[0]);
    }
    return null;
}

function registerSmartComboBoxCustomElement() {
    customElements.define('smart-combobox', SmartComboBox);
}
class SmartComboBox extends HTMLElement {
    constructor() {
        super(...arguments);
        this.requestSuggestionsTimeout = 0;
        this.debounceKeystrokesDelay = 250;
        this.currentAbortController = null;
        this.selectedIndex = 0;
    }
    connectedCallback() {
        this.inputElem = this.previousElementSibling;
        if (!(this.inputElem instanceof HTMLInputElement)) {
            throw new Error('smart-combobox must be placed immediately after an input element');
        }
        this.id = `smartcombobox-suggestions-${SmartComboBox.nextSuggestionsElemId++}`;
        this.classList.add('smartcombobox-suggestions');
        this.addEventListener('mousedown', event => {
            if (event.target instanceof HTMLElement && event.target.classList.contains('smartcombobox-suggestion')) {
                this._handleSuggestionSelected(event.target);
            }
        });
        this.inputElem.setAttribute('aria-controls', this.id);
        this._setSuggestions([]);
        this.inputElem.addEventListener('keydown', event => {
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                this._updateSelection({ offset: -1, updateInputToMatch: true });
            }
            else if (event.key === 'ArrowDown') {
                event.preventDefault();
                this._updateSelection({ offset: 1, updateInputToMatch: true });
            }
            else if (event.key === 'Enter') {
                event.preventDefault();
                const suggestion = this.children[this.selectedIndex];
                if (suggestion) {
                    this._handleSuggestionSelected(suggestion);
                }
            }
        });
        this.inputElem.addEventListener('input', event => {
            var _a;
            if (event instanceof CustomEvent && event.detail.fromSmartComponents) {
                return; // When we triggered the update programmatically, that's not a reason to fetch more suggestions
            }
            clearTimeout(this.requestSuggestionsTimeout);
            (_a = this.currentAbortController) === null || _a === void 0 ? void 0 : _a.abort();
            this.currentAbortController = null;
            if (this.inputElem.value === '') {
                this._setSuggestions([]);
            }
            else {
                this.requestSuggestionsTimeout = setTimeout(() => {
                    this._requestSuggestions();
                }, this.debounceKeystrokesDelay);
            }
        });
        this.inputElem.addEventListener('focus', () => this._updateAriaStates());
        this.inputElem.addEventListener('blur', () => this._updateAriaStates());
    }
    async _requestSuggestions() {
        this.currentAbortController = new AbortController();
        const body = {
            inputValue: this.inputElem.value,
            maxResults: this.getAttribute('data-max-suggestions'),
            similarityThreshold: this.getAttribute('data-similarity-threshold'),
        };
        const antiforgeryName = this.getAttribute('data-antiforgery-name');
        if (antiforgeryName) {
            body[antiforgeryName] = this.getAttribute('data-antiforgery-value');
        }
        let response;
        const requestInit = {
            method: 'post',
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(body),
            signal: this.currentAbortController.signal,
        };
        try {
            // We rely on the URL being pathbase-relative for Blazor, or a ~/... URL that would already
            // be resolved on the server for MVC
            response = await fetch(this.getAttribute('data-suggestions-url'), requestInit);
            const suggestions = await response.json();
            this._setSuggestions(suggestions);
        }
        catch (ex) {
            if (ex instanceof DOMException && ex.name === 'AbortError') {
                return;
            }
            throw ex;
        }
    }
    _setSuggestions(suggestions) {
        while (this.firstElementChild) {
            this.firstElementChild.remove();
        }
        let optionIndex = 0;
        suggestions.forEach(choice => {
            const option = document.createElement('div');
            option.id = `${this.id}_item${optionIndex++}`;
            option.setAttribute('role', 'option');
            option.setAttribute('aria-selected', 'false');
            option.classList.add('smartcombobox-suggestion');
            option.textContent = choice;
            this.appendChild(option);
        });
        if (suggestions.length) {
            this._updateSelection({ suggestion: this.children[0] });
            this.style.display = null; // Allow visibility to be controlled by focus rule in CSS
            // We rely on the input not moving relative to its offsetParent while the suggestions
            // are visible. Developers can always put the input directly inside a relatively-positioned
            // container if they need this to work on a fine-grained basis.
            this.style.top = this.inputElem.offsetTop + this.inputElem.offsetHeight + 'px';
            this.style.left = this.inputElem.offsetLeft + 'px';
            this.style.width = this.inputElem.offsetWidth + 'px';
        }
        else {
            this.style.display = 'none';
        }
        this._updateAriaStates();
    }
    _updateAriaStates() {
        // aria-expanded
        const isExpanded = this.firstChild && document.activeElement === this.inputElem;
        this.inputElem.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
        // aria-activedescendant
        const suggestion = isExpanded && this.children[this.selectedIndex];
        if (!suggestion) {
            this.inputElem.removeAttribute('aria-activedescendant');
        }
        else {
            this.inputElem.setAttribute('aria-activedescendant', suggestion.id);
        }
    }
    _handleSuggestionSelected(suggestion) {
        this._updateSelection({ suggestion, updateInputToMatch: true });
        this.inputElem.blur();
    }
    _updateSelection(operation) {
        let suggestion = operation.suggestion;
        if (suggestion) {
            this.selectedIndex = Array.from(this.children).indexOf(suggestion);
        }
        else {
            if (isNaN(operation.offset)) {
                throw new Error('Supply either offset or selection element');
            }
            const newIndex = Math.max(0, Math.min(this.children.length - 1, this.selectedIndex + operation.offset));
            if (newIndex === this.selectedIndex) {
                return;
            }
            this.selectedIndex = newIndex;
            suggestion = this.children[newIndex];
        }
        const prevSelectedSuggestion = this.querySelector('.selected');
        if (prevSelectedSuggestion === suggestion && this.inputElem.value === suggestion.textContent) {
            return;
        }
        prevSelectedSuggestion === null || prevSelectedSuggestion === void 0 ? void 0 : prevSelectedSuggestion.setAttribute('aria-selected', 'false');
        prevSelectedSuggestion === null || prevSelectedSuggestion === void 0 ? void 0 : prevSelectedSuggestion.classList.remove('selected');
        suggestion.setAttribute('aria-selected', 'true');
        suggestion.classList.add('selected');
        if (suggestion['scrollIntoViewIfNeeded']) {
            suggestion['scrollIntoViewIfNeeded'](false);
        }
        else {
            // Firefox doesn't support scrollIntoViewIfNeeded, so we fall back on scrollIntoView.
            // This will align the top of the suggestion with the top of the scrollable area.
            suggestion.scrollIntoView();
        }
        this._updateAriaStates();
        if (operation.updateInputToMatch) {
            setFormElementValueWithEvents(this.inputElem, suggestion.textContent || '');
        }
    }
}
SmartComboBox.nextSuggestionsElemId = 0;

function registerSmartPasteClickHandler() {
    document.addEventListener('click', (evt) => {
        const target = evt.target;
        if (target instanceof Element) {
            const button = target.closest('button[data-smart-paste-trigger=true]');
            if (button instanceof HTMLButtonElement) {
                performSmartPaste(button);
            }
        }
    });
}
async function performSmartPaste(button) {
    const form = button.closest('form');
    if (!form) {
        console.error('A smart paste button was clicked, but it is not inside a form');
        return;
    }
    const formConfig = extractFormConfig(form);
    if (formConfig.length == 0) {
        console.warn('A smart paste button was clicked, but no fields were found in its form');
        return;
    }
    const clipboardContents = await readClipboardText();
    if (!clipboardContents) {
        console.info('A smart paste button was clicked, but no data was found on the clipboard');
        return;
    }
    try {
        button.disabled = true;
        const response = await getSmartPasteResponse(button, formConfig, clipboardContents);
        const responseText = await response.text();
        populateForm(form, formConfig, responseText);
    }
    finally {
        button.disabled = false;
    }
}
function populateForm(form, formConfig, responseText) {
    let resultData;
    try {
        resultData = JSON.parse(responseText);
    }
    catch (_a) {
        return;
    }
    formConfig.forEach(field => {
        // For missing fields, it's usually better to leave the existing field data in place, since there
        // might be useful values in unrelated fields. It would be nice if the inference could conclusively
        // determine cases when a field should be cleared, but in most cases it can't distinguish "no
        // information available" from "the value should definitely be blanked out".
        let value = resultData[field.identifier];
        if (value !== undefined && value !== null) {
            value = value.toString().trim();
            if (field.element instanceof HTMLInputElement && field.element.type === 'radio') {
                // Radio is a bit more complex than the others as it's not just a single form element
                // We have to find the one corresponding to the new value, which in turn depends on
                // how we're interpreting the field description
                const radioInputToSelect = findInputRadioByText(form, field.element.name, value);
                if (radioInputToSelect) {
                    setFormElementValueWithEvents(radioInputToSelect, true);
                }
            }
            else {
                setFormElementValueWithEvents(field.element, value);
            }
        }
    });
}
function findInputRadioByText(form, radioGroupName, valueText) {
    const candidates = Array.from(form.querySelectorAll('input[type=radio]'))
        .filter(e => e instanceof HTMLInputElement && e.name === radioGroupName)
        .map(e => ({ elem: e, text: inferFieldDescription(form, e) }));
    const exactMatches = candidates.filter(o => o.text === valueText);
    if (exactMatches.length > 0) {
        return exactMatches[0].elem;
    }
    const partialMatches = candidates.filter(o => o.text && o.text.indexOf(valueText) >= 0);
    if (partialMatches.length === 1) {
        return partialMatches[0].elem;
    }
    return null;
}
async function readClipboardText() {
    const fake = document.getElementById('fake-clipboard');
    if (fake === null || fake === void 0 ? void 0 : fake.value) {
        return fake.value;
    }
    if (!navigator.clipboard.readText) {
        alert('The current browser does not support reading the clipboard.\n\nTODO: Implement alternate UI for this case.');
        return null;
    }
    return navigator.clipboard.readText();
}
function extractFormConfig(form) {
    const fields = [];
    let unidentifiedCount = 0;
    form.querySelectorAll('input, select, textarea').forEach(element => {
        if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) {
            return;
        }
        if (element.type === 'hidden' || isComboBox(element)) {
            return;
        }
        const isRadio = element.type === 'radio';
        const identifier = isRadio
            ? element.name
            : element.id || element.name || `unidentified_${++unidentifiedCount}`;
        // Only include one field for each related set of radio buttons
        if (isRadio && fields.find(f => f.identifier === identifier)) {
            return;
        }
        let description = null;
        if (!isRadio) {
            description = inferFieldDescription(form, element);
            if (!description) {
                // If we can't say anything about what this field represents, we have to exclude it
                return;
            }
        }
        const fieldEntry = {
            identifier: identifier,
            description: description,
            element: element,
            type: element.type === 'checkbox' ? 'boolean'
                : element.type === 'number' ? 'number' : 'string',
        };
        if (element instanceof HTMLSelectElement) {
            const options = Array.prototype.filter.call(element.querySelectorAll('option'), o => !!o.value);
            fieldEntry.allowedValues = Array.prototype.map.call(options, o => o.textContent);
            fieldEntry.type = 'fixed-choices';
        }
        else if (isRadio) {
            fieldEntry.allowedValues = [];
            fieldEntry.type = 'fixed-choices';
            Array.prototype.forEach.call(form.querySelectorAll('input[type=radio]'), e => {
                if (e.name === identifier) {
                    const choiceDescription = inferFieldDescription(form, e);
                    if (choiceDescription) {
                        fieldEntry.allowedValues.push(choiceDescription);
                    }
                }
            });
        }
        fields.push(fieldEntry);
    });
    return fields;
}
function inferFieldDescription(form, element) {
    // If there's explicit config, use it
    const smartPasteDescription = element.getAttribute('data-smartpaste-description');
    if (smartPasteDescription) {
        return smartPasteDescription;
    }
    // If there's an explicit label, use it
    const labels = element.id && form.querySelectorAll(`label[for='${element.id}']`);
    if (labels && labels.length === 1) {
        return labels[0].textContent.trim();
    }
    // Try searching up the DOM hierarchy to look for some container that only contains
    // this one field and has text
    let candidateContainer = element.parentElement;
    while (candidateContainer && candidateContainer !== form.parentElement) {
        const inputsInContainer = candidateContainer.querySelectorAll('input, select, textarea');
        if (inputsInContainer.length === 1 && inputsInContainer[0] === element) {
            // Here's a container in which this element is the only input. Any text here
            // will be assumed to describe the input.
            let text = candidateContainer.textContent.replace(/\s+/g, ' ').trim();
            if (text) {
                return text;
            }
        }
        candidateContainer = candidateContainer.parentElement;
    }
    // Fall back on name (because that's what would be bound on the server) or even ID
    // If even these have no data, we won't be able to use the field
    return element.getAttribute('name') || element.id;
}
async function getSmartPasteResponse(button, formConfig, clipboardContents) {
    const formFields = formConfig.map(entry => restrictProperties(entry, ['identifier', 'description', 'allowedValues', 'type']));
    const body = {
        dataJson: JSON.stringify({
            formFields,
            clipboardContents,
        })
    };
    const antiforgeryName = button.getAttribute('data-antiforgery-name');
    if (antiforgeryName) {
        body[antiforgeryName] = button.getAttribute('data-antiforgery-value');
    }
    // We rely on the URL being pathbase-relative for Blazor, or a ~/... URL that would already
    // be resolved on the server for MVC
    const url = button.getAttribute('data-url');
    return fetch(url, {
        method: 'post',
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(body)
    });
}
function restrictProperties(object, propertyNames) {
    const result = {};
    propertyNames.forEach(propertyName => {
        const value = object[propertyName];
        if (value !== undefined) {
            result[propertyName] = value;
        }
    });
    return result;
}

var attributes = ['borderBottomWidth', 'borderLeftWidth', 'borderRightWidth', 'borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle', 'borderTopWidth', 'boxSizing', 'fontFamily', 'fontSize', 'fontWeight', 'height', 'letterSpacing', 'lineHeight', 'marginBottom', 'marginLeft', 'marginRight', 'marginTop', 'outlineWidth', 'overflow', 'overflowX', 'overflowY', 'paddingBottom', 'paddingLeft', 'paddingRight', 'paddingTop', 'textAlign', 'textOverflow', 'textTransform', 'whiteSpace', 'wordBreak', 'wordWrap'];
/**
 * Create a mirror
 *
 * @param {Element} element The element
 * @param {string} html The html
 *
 * @return {object} The mirror object
 */

var createMirror = function createMirror(element, html) {
  /**
   * The mirror element
   */
  var mirror = document.createElement('div');
  /**
   * Create the CSS for the mirror object
   *
   * @return {object} The style object
   */

  var mirrorCss = function mirrorCss() {
    var css = {
      position: 'absolute',
      left: -9999,
      top: 0,
      zIndex: -2000
    };

    if (element.tagName === 'TEXTAREA') {
      attributes.push('width');
    }

    attributes.forEach(function (attr) {
      css[attr] = getComputedStyle(element)[attr];
    });
    return css;
  };
  /**
   * Initialize the mirror
   *
   * @param {string} html The html
   *
   * @return {void}
   */


  var initialize = function initialize(html) {
    var styles = mirrorCss();
    Object.keys(styles).forEach(function (key) {
      mirror.style[key] = styles[key];
    });
    mirror.innerHTML = html;
    element.parentNode.insertBefore(mirror, element.nextSibling);
  };
  /**
   * Get the rect
   *
   * @return {Rect} The bounding rect
   */


  var rect = function rect() {
    var marker = mirror.ownerDocument.getElementById('caret-position-marker');
    var boundingRect = {
      left: marker.offsetLeft,
      top: marker.offsetTop,
      height: marker.offsetHeight
    };
    mirror.parentNode.removeChild(mirror);
    return boundingRect;
  };

  initialize(html);
  return {
    rect: rect
  };
};

function _typeof(obj) {
  "@babel/helpers - typeof";

  if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
    _typeof = function (obj) {
      return typeof obj;
    };
  } else {
    _typeof = function (obj) {
      return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
    };
  }

  return _typeof(obj);
}

/**
 * Check if a DOM Element is content editable
 *
 * @param {Element} element  The DOM element
 *
 * @return {bool} If it is content editable
 */
var isContentEditable = function isContentEditable(element) {
  return !!(element.contentEditable ? element.contentEditable === 'true' : element.getAttribute('contenteditable') === 'true');
};
/**
 * Get the context from settings passed in
 *
 * @param {object} settings The settings object
 *
 * @return {object} window and document
 */

var getContext = function getContext() {
  var settings = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var customPos = settings.customPos,
      iframe = settings.iframe,
      noShadowCaret = settings.noShadowCaret;

  if (iframe) {
    return {
      iframe: iframe,
      window: iframe.contentWindow,
      document: iframe.contentDocument || iframe.contentWindow.document,
      noShadowCaret: noShadowCaret,
      customPos: customPos
    };
  }

  return {
    window: window,
    document: document,
    noShadowCaret: noShadowCaret,
    customPos: customPos
  };
};
/**
 * Get the offset of an element
 *
 * @param {Element} element The DOM element
 * @param {object} ctx The context
 *
 * @return {object} top and left
 */

var getOffset = function getOffset(element, ctx) {
  var win = ctx && ctx.window || window;
  var doc = ctx && ctx.document || document;
  var rect = element.getBoundingClientRect();
  var docEl = doc.documentElement;
  var scrollLeft = win.pageXOffset || docEl.scrollLeft;
  var scrollTop = win.pageYOffset || docEl.scrollTop;
  return {
    top: rect.top + scrollTop,
    left: rect.left + scrollLeft
  };
};
/**
 * Check if a value is an object
 *
 * @param {any} value The value to check
 *
 * @return {bool} If it is an object
 */

var isObject = function isObject(value) {
  return _typeof(value) === 'object' && value !== null;
};

/**
 * Create a Input caret object.
 *
 * @param {Element} element The element
 * @param {Object} ctx The context
 */

var createInputCaret = function createInputCaret(element, ctx) {
  /**
   * Get the current position
   *
   * @returns {int} The caret position
   */
  var getPos = function getPos() {
    return element.selectionStart;
  };
  /**
   * Set the position
   *
   * @param {int} pos The position
   *
   * @return {Element} The element
   */


  var setPos = function setPos(pos) {
    element.setSelectionRange(pos, pos);
    return element;
  };
  /**
   * The offset
   *
   * @param {int} pos The position
   *
   * @return {object} The offset
   */


  var getOffset$1 = function getOffset$1(pos) {
    var rect = getOffset(element);
    var position = getPosition(pos);
    return {
      top: rect.top + position.top + ctx.document.body.scrollTop,
      left: rect.left + position.left + ctx.document.body.scrollLeft,
      height: position.height
    };
  };
  /**
   * Get the current position
   *
   * @param {int} pos The position
   *
   * @return {object} The position
   */


  var getPosition = function getPosition(pos) {
    var format = function format(val) {
      var value = val.replace(/<|>|`|"|&/g, '?').replace(/\r\n|\r|\n/g, '<br/>');
      return value;
    };

    if (ctx.customPos || ctx.customPos === 0) {
      pos = ctx.customPos;
    }

    var position = pos === undefined ? getPos() : pos;
    var startRange = element.value.slice(0, position);
    var endRange = element.value.slice(position);
    var html = "<span style=\"position: relative; display: inline;\">".concat(format(startRange), "</span>");
    html += '<span id="caret-position-marker" style="position: relative; display: inline;">|</span>';
    html += "<span style=\"position: relative; display: inline;\">".concat(format(endRange), "</span>");
    var mirror = createMirror(element, html);
    var rect = mirror.rect();
    rect.pos = getPos();
    return rect;
  };

  return {
    getPos: getPos,
    setPos: setPos,
    getOffset: getOffset$1,
    getPosition: getPosition
  };
};

/**
 * Create an Editable Caret
 * @param {Element} element The editable element
 * @param {object|null} ctx The context
 *
 * @return {EditableCaret}
 */
var createEditableCaret = function createEditableCaret(element, ctx) {
  /**
   * Set the caret position
   *
   * @param {int} pos The position to se
   *
   * @return {Element} The element
   */
  var setPos = function setPos(pos) {
    var sel = ctx.window.getSelection();

    if (sel) {
      var offset = 0;
      var found = false;

      var find = function find(position, parent) {
        for (var i = 0; i < parent.childNodes.length; i++) {
          var node = parent.childNodes[i];

          if (found) {
            break;
          }

          if (node.nodeType === 3) {
            if (offset + node.length >= position) {
              found = true;
              var range = ctx.document.createRange();
              range.setStart(node, position - offset);
              sel.removeAllRanges();
              sel.addRange(range);
              break;
            } else {
              offset += node.length;
            }
          } else {
            find(pos, node);
          }
        }
      };

      find(pos, element);
    }

    return element;
  };
  /**
   * Get the offset
   *
   * @return {object} The offset
   */


  var getOffset = function getOffset() {
    var range = getRange();
    var offset = {
      height: 0,
      left: 0,
      right: 0
    };

    if (!range) {
      return offset;
    }

    var hasCustomPos = ctx.customPos || ctx.customPos === 0; // endContainer in Firefox would be the element at the start of
    // the line

    if (range.endOffset - 1 > 0 && range.endContainer !== element || hasCustomPos) {
      var clonedRange = range.cloneRange();
      var fixedPosition = hasCustomPos ? ctx.customPos : range.endOffset;
      clonedRange.setStart(range.endContainer, fixedPosition - 1 < 0 ? 0 : fixedPosition - 1);
      clonedRange.setEnd(range.endContainer, fixedPosition);
      var rect = clonedRange.getBoundingClientRect();
      offset = {
        height: rect.height,
        left: rect.left + rect.width,
        top: rect.top
      };
      clonedRange.detach();
    }

    if ((!offset || offset && offset.height === 0) && !ctx.noShadowCaret) {
      var _clonedRange = range.cloneRange();

      var shadowCaret = ctx.document.createTextNode('|');

      _clonedRange.insertNode(shadowCaret);

      _clonedRange.selectNode(shadowCaret);

      var _rect = _clonedRange.getBoundingClientRect();

      offset = {
        height: _rect.height,
        left: _rect.left,
        top: _rect.top
      };
      shadowCaret.parentNode.removeChild(shadowCaret);

      _clonedRange.detach();
    }

    if (offset) {
      var doc = ctx.document.documentElement;
      offset.top += ctx.window.pageYOffset - (doc.clientTop || 0);
      offset.left += ctx.window.pageXOffset - (doc.clientLeft || 0);
    }

    return offset;
  };
  /**
   * Get the position
   *
   * @return {object} The position
   */


  var getPosition = function getPosition() {
    var offset = getOffset();
    var pos = getPos();
    var rect = element.getBoundingClientRect();
    var inputOffset = {
      top: rect.top + ctx.document.body.scrollTop,
      left: rect.left + ctx.document.body.scrollLeft
    };
    offset.left -= inputOffset.left;
    offset.top -= inputOffset.top;
    offset.pos = pos;
    return offset;
  };
  /**
   * Get the range
   *
   * @return {Range|null}
   */


  var getRange = function getRange() {
    if (!ctx.window.getSelection) {
      return;
    }

    var sel = ctx.window.getSelection();
    return sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
  };
  /**
   * Get the caret position
   *
   * @return {int} The position
   */


  var getPos = function getPos() {
    var range = getRange();
    var clonedRange = range.cloneRange();
    clonedRange.selectNodeContents(element);
    clonedRange.setEnd(range.endContainer, range.endOffset);
    var pos = clonedRange.toString().length;
    clonedRange.detach();
    return pos;
  };

  return {
    getPos: getPos,
    setPos: setPos,
    getPosition: getPosition,
    getOffset: getOffset,
    getRange: getRange
  };
};

var createCaret = function createCaret(element, ctx) {
  if (isContentEditable(element)) {
    return createEditableCaret(element, ctx);
  }

  return createInputCaret(element, ctx);
};

var position = function position(element, value) {
  var settings = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  var options = settings;

  if (isObject(value)) {
    options = value;
    value = null;
  }

  var ctx = getContext(options);
  var caret = createCaret(element, ctx);

  if (value || value === 0) {
    return caret.setPos(value);
  }

  return caret.getPosition();
};

function scrollTextAreaDownToCaretIfNeeded(textArea) {
    // Note that this only scrolls *down*, because that's the only scenario after a suggestion is accepted
    const pos = position(textArea);
    const lineHeightInPixels = parseFloat(window.getComputedStyle(textArea).lineHeight);
    if (pos.top > textArea.clientHeight + textArea.scrollTop - lineHeightInPixels) {
        textArea.scrollTop = pos.top - textArea.clientHeight + lineHeightInPixels;
    }
}
function getCaretOffsetFromOffsetParent(elem) {
    const elemStyle = window.getComputedStyle(elem);
    const pos = position(elem);
    return {
        top: pos.top + parseFloat(elemStyle.borderTopWidth) + elem.offsetTop - elem.scrollTop,
        left: pos.left + parseFloat(elemStyle.borderLeftWidth) + elem.offsetLeft - elem.scrollLeft - 0.25,
        height: pos.height,
        elemStyle: elemStyle,
    };
}
function insertTextAtCaretPosition(textArea, text) {
    // Even though document.execCommand is deprecated, it's still the best way to insert text, because it's
    // the only way that interacts correctly with the undo buffer. If we have to fall back on mutating
    // the .value property directly, it works but erases the undo buffer.
    if (document.execCommand) {
        document.execCommand('insertText', false, text);
    }
    else {
        let caretPos = textArea.selectionStart;
        textArea.value = textArea.value.substring(0, caretPos)
            + text
            + textArea.value.substring(textArea.selectionEnd);
        caretPos += text.length;
        textArea.setSelectionRange(caretPos, caretPos);
    }
}

class InlineSuggestionDisplay {
    constructor(owner, textArea) {
        this.owner = owner;
        this.textArea = textArea;
        this.latestSuggestionText = '';
        this.suggestionStartPos = null;
        this.suggestionEndPos = null;
        this.fakeCaret = null;
        // When any other JS code asks for the value of the textarea, we want to return the value
        // without any pending suggestion, otherwise it will break things like bindings
        this.originalValueProperty = findPropertyRecursive(textArea, 'value');
        const self = this;
        Object.defineProperty(textArea, 'value', {
            get() {
                const trueValue = self.originalValueProperty.get.call(textArea);
                return self.isShowing()
                    ? trueValue.substring(0, self.suggestionStartPos) + trueValue.substring(self.suggestionEndPos)
                    : trueValue;
            },
            set(v) {
                self.originalValueProperty.set.call(textArea, v);
            }
        });
    }
    get valueIncludingSuggestion() {
        return this.originalValueProperty.get.call(this.textArea);
    }
    set valueIncludingSuggestion(val) {
        this.originalValueProperty.set.call(this.textArea, val);
    }
    isShowing() {
        return this.suggestionStartPos !== null;
    }
    show(suggestion) {
        var _a;
        this.latestSuggestionText = suggestion;
        this.suggestionStartPos = this.textArea.selectionStart;
        this.suggestionEndPos = this.suggestionStartPos + suggestion.length;
        this.textArea.setAttribute('data-suggestion-visible', '');
        this.valueIncludingSuggestion = this.valueIncludingSuggestion.substring(0, this.suggestionStartPos) + suggestion + this.valueIncludingSuggestion.substring(this.suggestionStartPos);
        this.textArea.setSelectionRange(this.suggestionStartPos, this.suggestionEndPos);
        (_a = this.fakeCaret) !== null && _a !== void 0 ? _a : (this.fakeCaret = new FakeCaret(this.owner, this.textArea));
        this.fakeCaret.show();
    }
    get currentSuggestion() {
        return this.latestSuggestionText;
    }
    accept() {
        var _a;
        this.textArea.setSelectionRange(this.suggestionEndPos, this.suggestionEndPos);
        this.suggestionStartPos = null;
        this.suggestionEndPos = null;
        (_a = this.fakeCaret) === null || _a === void 0 ? void 0 : _a.hide();
        this.textArea.removeAttribute('data-suggestion-visible');
        // The newly-inserted text could be so long that the new caret position is off the bottom of the textarea.
        // It won't scroll to the new caret position by default
        scrollTextAreaDownToCaretIfNeeded(this.textArea);
    }
    reject() {
        var _a;
        if (!this.isShowing()) {
            return; // No suggestion is shown
        }
        const prevSelectionStart = this.textArea.selectionStart;
        const prevSelectionEnd = this.textArea.selectionEnd;
        this.valueIncludingSuggestion = this.valueIncludingSuggestion.substring(0, this.suggestionStartPos) + this.valueIncludingSuggestion.substring(this.suggestionEndPos);
        if (this.suggestionStartPos === prevSelectionStart && this.suggestionEndPos === prevSelectionEnd) {
            // For most interactions we don't need to do anything to preserve the cursor position, but for
            // 'scroll' events we do (because the interaction isn't going to set a cursor position naturally)
            this.textArea.setSelectionRange(prevSelectionStart, prevSelectionStart /* not 'end' because we removed the suggestion */);
        }
        this.suggestionStartPos = null;
        this.suggestionEndPos = null;
        this.textArea.removeAttribute('data-suggestion-visible');
        (_a = this.fakeCaret) === null || _a === void 0 ? void 0 : _a.hide();
    }
}
class FakeCaret {
    constructor(owner, textArea) {
        this.textArea = textArea;
        this.caretDiv = document.createElement('div');
        this.caretDiv.classList.add('smart-textarea-caret');
        owner.appendChild(this.caretDiv);
    }
    show() {
        const caretOffset = getCaretOffsetFromOffsetParent(this.textArea);
        const style = this.caretDiv.style;
        style.display = 'block';
        style.top = caretOffset.top + 'px';
        style.left = caretOffset.left + 'px';
        style.height = caretOffset.height + 'px';
        style.zIndex = this.textArea.style.zIndex;
        style.backgroundColor = caretOffset.elemStyle.caretColor;
    }
    hide() {
        this.caretDiv.style.display = 'none';
    }
}
function findPropertyRecursive(obj, propName) {
    while (obj) {
        const descriptor = Object.getOwnPropertyDescriptor(obj, propName);
        if (descriptor) {
            return descriptor;
        }
        obj = Object.getPrototypeOf(obj);
    }
    throw new Error(`Property ${propName} not found on object or its prototype chain`);
}

class OverlaySuggestionDisplay {
    constructor(owner, textArea) {
        this.textArea = textArea;
        this.latestSuggestionText = '';
        this.suggestionElement = document.createElement('div');
        this.suggestionElement.classList.add('smart-textarea-suggestion-overlay');
        this.suggestionElement.addEventListener('mousedown', e => this.handleSuggestionClicked(e));
        this.suggestionElement.addEventListener('touchend', e => this.handleSuggestionClicked(e));
        this.suggestionPrefixElement = document.createElement('span');
        this.suggestionTextElement = document.createElement('span');
        this.suggestionElement.appendChild(this.suggestionPrefixElement);
        this.suggestionElement.appendChild(this.suggestionTextElement);
        this.suggestionPrefixElement.style.opacity = '0.3';
        const computedStyle = window.getComputedStyle(this.textArea);
        this.suggestionElement.style.font = computedStyle.font;
        this.suggestionElement.style.marginTop = (parseFloat(computedStyle.fontSize) * 1.4) + 'px';
        owner.appendChild(this.suggestionElement);
    }
    get currentSuggestion() {
        return this.latestSuggestionText;
    }
    show(suggestion) {
        this.latestSuggestionText = suggestion;
        this.suggestionPrefixElement.textContent = suggestion[0] != ' ' ? getCurrentIncompleteWord(this.textArea, 20) : '';
        this.suggestionTextElement.textContent = suggestion;
        const caretOffset = getCaretOffsetFromOffsetParent(this.textArea);
        const style = this.suggestionElement.style;
        style.minWidth = null;
        this.suggestionElement.classList.add('smart-textarea-suggestion-overlay-visible');
        style.zIndex = this.textArea.style.zIndex;
        style.top = caretOffset.top + 'px';
        // If the horizontal position is already close enough, leave it alone. Otherwise it
        // can jiggle annoyingly due to inaccuracies in measuring the caret position.
        const newLeftPos = caretOffset.left - this.suggestionPrefixElement.offsetWidth;
        if (!style.left || Math.abs(parseFloat(style.left) - newLeftPos) > 10) {
            style.left = newLeftPos + 'px';
        }
        this.showing = true;
        // Normally we're happy for the overlay to take up as much width as it can up to the edge of the page.
        // However, if it's too narrow (because the edge of the page is already too close), it will wrap onto
        // many lines. In this case we'll force it to get wider, and then we have to move it further left to
        // avoid spilling off the screen.
        const suggestionComputedStyle = window.getComputedStyle(this.suggestionElement);
        const numLinesOfText = Math.round((this.suggestionElement.offsetHeight - parseFloat(suggestionComputedStyle.paddingTop) - parseFloat(suggestionComputedStyle.paddingBottom))
            / parseFloat(suggestionComputedStyle.lineHeight));
        if (numLinesOfText > 2) {
            const oldWidth = this.suggestionElement.offsetWidth;
            style.minWidth = `calc(min(70vw, ${(numLinesOfText * oldWidth / 2)}px))`; // Aim for 2 lines, but don't get wider than 70% of the screen
        }
        // If the suggestion is too far to the right, move it left so it's not off the screen
        const suggestionClientRect = this.suggestionElement.getBoundingClientRect();
        if (suggestionClientRect.right > document.body.clientWidth - 20) {
            style.left = `calc(${parseFloat(style.left) - (suggestionClientRect.right - document.body.clientWidth)}px - 2rem)`;
        }
    }
    accept() {
        if (!this.showing) {
            return;
        }
        insertTextAtCaretPosition(this.textArea, this.currentSuggestion);
        // The newly-inserted text could be so long that the new caret position is off the bottom of the textarea.
        // It won't scroll to the new caret position by default
        scrollTextAreaDownToCaretIfNeeded(this.textArea);
        this.hide();
    }
    reject() {
        this.hide();
    }
    hide() {
        if (this.showing) {
            this.showing = false;
            this.suggestionElement.classList.remove('smart-textarea-suggestion-overlay-visible');
        }
    }
    isShowing() {
        return this.showing;
    }
    handleSuggestionClicked(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.accept();
    }
}
function getCurrentIncompleteWord(textArea, maxLength) {
    const text = textArea.value;
    const caretPos = textArea.selectionStart;
    // Not all languages have words separated by spaces. Imposing the maxlength rule
    // means we'll not show the prefix for those languages if you're in the middle
    // of longer text (and ensures we don't search through a long block), which is ideal.
    for (let i = caretPos - 1; i > caretPos - maxLength; i--) {
        if (i < 0 || text[i].match(/\s/)) {
            return text.substring(i + 1, caretPos);
        }
    }
    return '';
}

function registerSmartTextAreaCustomElement() {
    customElements.define('smart-textarea', SmartTextArea);
}
class SmartTextArea extends HTMLElement {
    constructor() {
        super(...arguments);
        this.typingDebounceTimeout = null;
    }
    connectedCallback() {
        if (!(this.previousElementSibling instanceof HTMLTextAreaElement)) {
            throw new Error('smart-textarea must be rendered immediately after a textarea element');
        }
        this.textArea = this.previousElementSibling;
        this.suggestionDisplay = shouldUseInlineSuggestions(this.textArea)
            ? new InlineSuggestionDisplay(this, this.textArea)
            : new OverlaySuggestionDisplay(this, this.textArea);
        this.textArea.addEventListener('keydown', e => this.handleKeyDown(e));
        this.textArea.addEventListener('keyup', e => this.handleKeyUp(e));
        this.textArea.addEventListener('mousedown', () => this.removeExistingOrPendingSuggestion());
        this.textArea.addEventListener('focusout', () => this.removeExistingOrPendingSuggestion());
        // If you scroll, we don't need to kill any pending suggestion request, but we do need to hide
        // any suggestion that's already visible because the fake cursor will now be in the wrong place
        this.textArea.addEventListener('scroll', () => this.suggestionDisplay.reject(), { passive: true });
    }
    handleKeyDown(event) {
        switch (event.key) {
            case 'Tab':
                if (this.suggestionDisplay.isShowing()) {
                    this.suggestionDisplay.accept();
                    event.preventDefault();
                }
                break;
            case 'Alt':
            case 'Control':
            case 'Shift':
            case 'Command':
                break;
            default:
                const keyMatchesExistingSuggestion = this.suggestionDisplay.isShowing()
                    && this.suggestionDisplay.currentSuggestion.startsWith(event.key);
                if (keyMatchesExistingSuggestion) {
                    // Let the typing happen, but without side-effects like removing the existing selection
                    insertTextAtCaretPosition(this.textArea, event.key);
                    event.preventDefault();
                    // Update the existing suggestion to match the new text
                    this.suggestionDisplay.show(this.suggestionDisplay.currentSuggestion.substring(event.key.length));
                    scrollTextAreaDownToCaretIfNeeded(this.textArea);
                }
                else {
                    this.removeExistingOrPendingSuggestion();
                }
                break;
        }
    }
    keyMatchesExistingSuggestion(key) {
        return;
    }
    // If this was changed to a 'keypress' event instead, we'd only initiate suggestions after
    // the user types a visible character, not pressing another key (e.g., arrows, or ctrl+c).
    // However for now I think it is desirable to show suggestions after cursor movement.
    handleKeyUp(event) {
        // If a suggestion is already visible, it must match the current keystroke or it would
        // already have been removed during keydown. So we only start the timeout process if
        // there's no visible suggestion.
        if (!this.suggestionDisplay.isShowing()) {
            clearTimeout(this.typingDebounceTimeout);
            this.typingDebounceTimeout = setTimeout(() => this.handleTypingPaused(), 350);
        }
    }
    handleTypingPaused() {
        if (document.activeElement !== this.textArea) {
            return;
        }
        // We only show a suggestion if the cursor is at the end of the current line. Inserting suggestions in
        // the middle of a line is confusing (things move around in unusual ways).
        // TODO: You could also allow the case where all remaining text on the current line is whitespace
        const isAtEndOfCurrentLine = this.textArea.selectionStart === this.textArea.selectionEnd
            && (this.textArea.selectionStart === this.textArea.value.length || this.textArea.value[this.textArea.selectionStart] === '\n');
        if (!isAtEndOfCurrentLine) {
            return;
        }
        this.requestSuggestionAsync();
    }
    removeExistingOrPendingSuggestion() {
        var _a;
        clearTimeout(this.typingDebounceTimeout);
        (_a = this.pendingSuggestionAbortController) === null || _a === void 0 ? void 0 : _a.abort();
        this.pendingSuggestionAbortController = null;
        this.suggestionDisplay.reject();
    }
    async requestSuggestionAsync() {
        var _a;
        (_a = this.pendingSuggestionAbortController) === null || _a === void 0 ? void 0 : _a.abort();
        this.pendingSuggestionAbortController = new AbortController();
        const snapshot = {
            abortSignal: this.pendingSuggestionAbortController.signal,
            textAreaValue: this.textArea.value,
            cursorPosition: this.textArea.selectionStart,
        };
        const body = {
            // TODO: Limit the amount of text we send, e.g., to 100 characters before and after the cursor
            textBefore: snapshot.textAreaValue.substring(0, snapshot.cursorPosition),
            textAfter: snapshot.textAreaValue.substring(snapshot.cursorPosition),
            config: this.getAttribute('data-config'),
        };
        const antiforgeryName = this.getAttribute('data-antiforgery-name');
        if (antiforgeryName) {
            body[antiforgeryName] = this.getAttribute('data-antiforgery-value');
        }
        const requestInit = {
            method: 'post',
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(body),
            signal: snapshot.abortSignal,
        };
        let suggestionText;
        try {
            // We rely on the URL being pathbase-relative for Blazor, or a ~/... URL that would already
            // be resolved on the server for MVC
            const httpResponse = await fetch(this.getAttribute('data-url'), requestInit);
            suggestionText = httpResponse.ok ? await httpResponse.text() : null;
        }
        catch (ex) {
            if (ex instanceof DOMException && ex.name === 'AbortError') {
                return;
            }
        }
        // Normally if the user has made further edits in the textarea, our HTTP request would already
        // have been aborted so we wouldn't get here. But if something else (e.g., some other JS code)
        // mutates the textarea, we would still get here. It's important we don't apply the suggestion
        // if the textarea value or cursor position has changed, so compare against our snapshot.
        if (suggestionText
            && snapshot.textAreaValue === this.textArea.value
            && snapshot.cursorPosition === this.textArea.selectionStart) {
            if (!suggestionText.endsWith(' ')) {
                suggestionText += ' ';
            }
            this.suggestionDisplay.show(suggestionText);
        }
    }
}
function shouldUseInlineSuggestions(textArea) {
    // Allow the developer to specify this explicitly if they want
    const explicitConfig = textArea.getAttribute('data-inline-suggestions');
    if (explicitConfig) {
        return explicitConfig.toLowerCase() === 'true';
    }
    // ... but by default, we use overlay on touch devices, inline on non-touch devices
    // That's because:
    //  - Mobile devices will be touch, and most mobile users don't have a "tab" key by which to accept inline suggestions
    //  - Mobile devices such as iOS will display all kinds of extra UI around selected text (e.g., selection handles),
    //    which would look completely wrong
    // In general, the overlay approach is the risk-averse one that works everywhere, even though it's not as attractive.
    const isTouch = 'ontouchstart' in window; // True for any mobile. Usually not true for desktop.
    return !isTouch;
}

// Only run this script once. If you import it multiple times, the 2nd-and-later are no-ops.
const isLoadedMarker = '__smart_components_loaded__';
if (!Object.getOwnPropertyDescriptor(document, isLoadedMarker)) {
    Object.defineProperty(document, isLoadedMarker, { enumerable: false, writable: false });
    registerSmartComboBoxCustomElement();
    registerSmartPasteClickHandler();
    registerSmartTextAreaCustomElement();
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU21hcnRDb21wb25lbnRzLlN0YXRpY0Fzc2V0cy5saWIubW9kdWxlLmpzIiwic291cmNlcyI6WyIuLi90eXBlc2NyaXB0L0Zvcm1VdGlsLnRzIiwiLi4vdHlwZXNjcmlwdC9TbWFydENvbWJvQm94LnRzIiwiLi4vdHlwZXNjcmlwdC9TbWFydFBhc3RlLnRzIiwiLi4vbm9kZV9tb2R1bGVzL2NhcmV0LXBvcy9saWIvZXNtMjAxNS9tYWluLmpzIiwiLi4vdHlwZXNjcmlwdC9TbWFydFRleHRBcmVhL0NhcmV0VXRpbC50cyIsIi4uL3R5cGVzY3JpcHQvU21hcnRUZXh0QXJlYS9JbmxpbmVTdWdnZXN0aW9uRGlzcGxheS50cyIsIi4uL3R5cGVzY3JpcHQvU21hcnRUZXh0QXJlYS9PdmVybGF5U3VnZ2VzdGlvbkRpc3BsYXkudHMiLCIuLi90eXBlc2NyaXB0L1NtYXJ0VGV4dEFyZWEvU21hcnRUZXh0QXJlYS50cyIsIi4uL3R5cGVzY3JpcHQvbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gc2V0Rm9ybUVsZW1lbnRWYWx1ZVdpdGhFdmVudHMoZWxlbTogSFRNTElucHV0RWxlbWVudCB8IEhUTUxTZWxlY3RFbGVtZW50IHwgSFRNTFRleHRBcmVhRWxlbWVudCwgdmFsdWU6IHN0cmluZyB8IGJvb2xlYW4pIHtcbiAgICBpZiAoZWxlbSBpbnN0YW5jZW9mIEhUTUxTZWxlY3RFbGVtZW50KSB7XG4gICAgICAgIGNvbnN0IHZhbHVlVG9TdHJpbmcgPSB2YWx1ZS50b1N0cmluZygpO1xuICAgICAgICBjb25zdCBuZXdTZWxlY3RlZEluZGV4ID0gZmluZFNlbGVjdE9wdGlvbkJ5VGV4dChlbGVtLCB2YWx1ZVRvU3RyaW5nKTtcbiAgICAgICAgaWYgKG5ld1NlbGVjdGVkSW5kZXggIT09IG51bGwgJiYgZWxlbS5zZWxlY3RlZEluZGV4ICE9PSBuZXdTZWxlY3RlZEluZGV4KSB7XG4gICAgICAgICAgICBub3RpZnlGb3JtRWxlbWVudEJlZm9yZVdyaXR0ZW4oZWxlbSk7XG4gICAgICAgICAgICBlbGVtLnNlbGVjdGVkSW5kZXggPSBuZXdTZWxlY3RlZEluZGV4O1xuICAgICAgICAgICAgbm90aWZ5Rm9ybUVsZW1lbnRXcml0dGVuKGVsZW0pO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChlbGVtIGluc3RhbmNlb2YgSFRNTElucHV0RWxlbWVudCAmJiAoZWxlbS50eXBlID09PSAncmFkaW8nIHx8IGVsZW0udHlwZSA9PT0gJ2NoZWNrYm94JykpIHtcbiAgICAgICAgY29uc3QgdmFsdWVTdHJpbmdMb3dlciA9IHZhbHVlPy50b1N0cmluZygpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGNvbnN0IHNob3VsZENoZWNrID0gKHZhbHVlU3RyaW5nTG93ZXIgPT09IFwidHJ1ZVwiKSB8fCAodmFsdWVTdHJpbmdMb3dlciA9PT0gXCJ5ZXNcIikgfHwgKHZhbHVlU3RyaW5nTG93ZXIgPT09IFwib25cIik7XG4gICAgICAgIGlmIChlbGVtICYmIGVsZW0uY2hlY2tlZCAhPT0gc2hvdWxkQ2hlY2spIHtcbiAgICAgICAgICAgIG5vdGlmeUZvcm1FbGVtZW50QmVmb3JlV3JpdHRlbihlbGVtKTtcbiAgICAgICAgICAgIGVsZW0uY2hlY2tlZCA9IHNob3VsZENoZWNrO1xuICAgICAgICAgICAgbm90aWZ5Rm9ybUVsZW1lbnRXcml0dGVuKGVsZW0pO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGlzQ29tYm9Cb3goZWxlbSkpIHtcbiAgICAgICAgICAgIC8vIFRPRE86IFN1cHBvcnQgZGF0YWxpc3QgYnkgaW50ZXJwcmV0aW5nIGl0IGFzIGEgc2V0IG9mIGFsbG93ZWQgdmFsdWVzLiBXaGVuIHBvcHVsYXRpbmdcbiAgICAgICAgICAgIC8vIHRoZSBmb3JtLCBvbmx5IGFjY2VwdCBzdWdnZXN0aW9ucyB0aGF0IG1hdGNoIG9uZSBvZiB0aGUgYWxsb3dlZCB2YWx1ZXMuXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB2YWx1ZSA9IHZhbHVlLnRvU3RyaW5nKCk7XG4gICAgICAgIGlmIChlbGVtLnZhbHVlICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgbm90aWZ5Rm9ybUVsZW1lbnRCZWZvcmVXcml0dGVuKGVsZW0pO1xuICAgICAgICAgICAgZWxlbS52YWx1ZSA9IHZhbHVlO1xuICAgICAgICAgICAgbm90aWZ5Rm9ybUVsZW1lbnRXcml0dGVuKGVsZW0pO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNDb21ib0JveChlbGVtKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuICEhKGVsZW0ubGlzdCB8fCBlbGVtLmdldEF0dHJpYnV0ZSgnZGF0YS1hdXRvY29tcGxldGUnKSk7XG59XG5cbi8vIENsaWVudC1zaWRlIGNvZGUgKGUuZy4sIHZhbGlkYXRpb24pIG1heSByZWFjdCB3aGVuIGFuIGVsZW1lbnQgdmFsdWUgaXMgY2hhbmdlZFxuLy8gV2UnbGwgdHJpZ2dlciB0aGUgc2FtZSBraW5kcyBvZiBldmVudHMgdGhhdCBmaXJlIGlmIHlvdSB0eXBlXG5mdW5jdGlvbiBub3RpZnlGb3JtRWxlbWVudEJlZm9yZVdyaXR0ZW4oZWxlbTogSFRNTEVsZW1lbnQpIHtcbiAgICBlbGVtLmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KCdiZWZvcmVpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSwgZGV0YWlsOiB7IGZyb21TbWFydENvbXBvbmVudHM6IHRydWUgfSB9KSk7XG59XG5cbmZ1bmN0aW9uIG5vdGlmeUZvcm1FbGVtZW50V3JpdHRlbihlbGVtOiBIVE1MRWxlbWVudCkge1xuICAgIGVsZW0uZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ2lucHV0JywgeyBidWJibGVzOiB0cnVlLCBkZXRhaWw6IHsgZnJvbVNtYXJ0Q29tcG9uZW50czogdHJ1ZSB9IH0pKTtcbiAgICBlbGVtLmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KCdjaGFuZ2UnLCB7IGJ1YmJsZXM6IHRydWUsIGRldGFpbDogeyBmcm9tU21hcnRDb21wb25lbnRzOiB0cnVlIH0gfSkpO1xufVxuXG5mdW5jdGlvbiBmaW5kU2VsZWN0T3B0aW9uQnlUZXh0KHNlbGVjdEVsZW06IEhUTUxTZWxlY3RFbGVtZW50LCB2YWx1ZVRleHQ6IHN0cmluZyk6IG51bWJlciB8IG51bGwge1xuICAgIGNvbnN0IG9wdGlvbnMgPSBBcnJheS5mcm9tKHNlbGVjdEVsZW0ucXVlcnlTZWxlY3RvckFsbCgnb3B0aW9uJykpO1xuICAgIGNvbnN0IGV4YWN0TWF0Y2hlcyA9IG9wdGlvbnMuZmlsdGVyKG8gPT4gby50ZXh0Q29udGVudCA9PT0gdmFsdWVUZXh0KTtcbiAgICBpZiAoZXhhY3RNYXRjaGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgcmV0dXJuIG9wdGlvbnMuaW5kZXhPZihleGFjdE1hdGNoZXNbMF0pO1xuICAgIH1cblxuICAgIGNvbnN0IHBhcnRpYWxNYXRjaGVzID0gb3B0aW9ucy5maWx0ZXIobyA9PiBvLnRleHRDb250ZW50ICYmIG8udGV4dENvbnRlbnQuaW5kZXhPZih2YWx1ZVRleHQpID49IDApO1xuICAgIGlmIChwYXJ0aWFsTWF0Y2hlcy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgcmV0dXJuIG9wdGlvbnMuaW5kZXhPZihwYXJ0aWFsTWF0Y2hlc1swXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG59XG4iLCJpbXBvcnQgeyBzZXRGb3JtRWxlbWVudFZhbHVlV2l0aEV2ZW50cyB9IGZyb20gJy4vRm9ybVV0aWwnO1xuXG5leHBvcnQgZnVuY3Rpb24gcmVnaXN0ZXJTbWFydENvbWJvQm94Q3VzdG9tRWxlbWVudCgpIHtcbiAgICBjdXN0b21FbGVtZW50cy5kZWZpbmUoJ3NtYXJ0LWNvbWJvYm94JywgU21hcnRDb21ib0JveCk7XG59XG5cbmNsYXNzIFNtYXJ0Q29tYm9Cb3ggZXh0ZW5kcyBIVE1MRWxlbWVudCB7XG4gICAgaW5wdXRFbGVtOiBIVE1MSW5wdXRFbGVtZW50O1xuICAgIHJlcXVlc3RTdWdnZXN0aW9uc1RpbWVvdXQgPSAwO1xuICAgIGRlYm91bmNlS2V5c3Ryb2tlc0RlbGF5ID0gMjUwO1xuICAgIGN1cnJlbnRBYm9ydENvbnRyb2xsZXI6IEFib3J0Q29udHJvbGxlciB8IG51bGwgPSBudWxsO1xuICAgIHNlbGVjdGVkSW5kZXggPSAwO1xuICAgIHN0YXRpYyBuZXh0U3VnZ2VzdGlvbnNFbGVtSWQgPSAwO1xuXG4gICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIHRoaXMuaW5wdXRFbGVtID0gdGhpcy5wcmV2aW91c0VsZW1lbnRTaWJsaW5nIGFzIEhUTUxJbnB1dEVsZW1lbnQ7XG4gICAgICAgIGlmICghKHRoaXMuaW5wdXRFbGVtIGluc3RhbmNlb2YgSFRNTElucHV0RWxlbWVudCkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignc21hcnQtY29tYm9ib3ggbXVzdCBiZSBwbGFjZWQgaW1tZWRpYXRlbHkgYWZ0ZXIgYW4gaW5wdXQgZWxlbWVudCcpO1xuICAgICAgICB9XG4gXG4gICAgICAgIHRoaXMuaWQgPSBgc21hcnRjb21ib2JveC1zdWdnZXN0aW9ucy0ke1NtYXJ0Q29tYm9Cb3gubmV4dFN1Z2dlc3Rpb25zRWxlbUlkKyt9YDtcbiAgICAgICAgdGhpcy5jbGFzc0xpc3QuYWRkKCdzbWFydGNvbWJvYm94LXN1Z2dlc3Rpb25zJyk7XG4gICAgICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgZXZlbnQgPT4ge1xuICAgICAgICAgICAgaWYgKGV2ZW50LnRhcmdldCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50ICYmIGV2ZW50LnRhcmdldC5jbGFzc0xpc3QuY29udGFpbnMoJ3NtYXJ0Y29tYm9ib3gtc3VnZ2VzdGlvbicpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faGFuZGxlU3VnZ2VzdGlvblNlbGVjdGVkKGV2ZW50LnRhcmdldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuaW5wdXRFbGVtLnNldEF0dHJpYnV0ZSgnYXJpYS1jb250cm9scycsIHRoaXMuaWQpO1xuICAgICAgICB0aGlzLl9zZXRTdWdnZXN0aW9ucyhbXSk7XG5cbiAgICAgICAgdGhpcy5pbnB1dEVsZW0uYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGV2ZW50ID0+IHtcbiAgICAgICAgICAgIGlmIChldmVudC5rZXkgPT09ICdBcnJvd1VwJykge1xuICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgdGhpcy5fdXBkYXRlU2VsZWN0aW9uKHsgb2Zmc2V0OiAtMSwgdXBkYXRlSW5wdXRUb01hdGNoOiB0cnVlIH0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChldmVudC5rZXkgPT09ICdBcnJvd0Rvd24nKSB7XG4gICAgICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICB0aGlzLl91cGRhdGVTZWxlY3Rpb24oeyBvZmZzZXQ6IDEsIHVwZGF0ZUlucHV0VG9NYXRjaDogdHJ1ZSB9KTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZXZlbnQua2V5ID09PSAnRW50ZXInKSB7XG4gICAgICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICBjb25zdCBzdWdnZXN0aW9uID0gdGhpcy5jaGlsZHJlblt0aGlzLnNlbGVjdGVkSW5kZXhdIGFzIEhUTUxFbGVtZW50O1xuICAgICAgICAgICAgICAgIGlmIChzdWdnZXN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2hhbmRsZVN1Z2dlc3Rpb25TZWxlY3RlZChzdWdnZXN0aW9uKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuaW5wdXRFbGVtLmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgZXZlbnQgPT4ge1xuICAgICAgICAgICAgaWYgKGV2ZW50IGluc3RhbmNlb2YgQ3VzdG9tRXZlbnQgJiYgZXZlbnQuZGV0YWlsLmZyb21TbWFydENvbXBvbmVudHMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47IC8vIFdoZW4gd2UgdHJpZ2dlcmVkIHRoZSB1cGRhdGUgcHJvZ3JhbW1hdGljYWxseSwgdGhhdCdzIG5vdCBhIHJlYXNvbiB0byBmZXRjaCBtb3JlIHN1Z2dlc3Rpb25zXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aGlzLnJlcXVlc3RTdWdnZXN0aW9uc1RpbWVvdXQpO1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50QWJvcnRDb250cm9sbGVyPy5hYm9ydCgpO1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50QWJvcnRDb250cm9sbGVyID0gbnVsbDtcblxuICAgICAgICAgICAgaWYgKHRoaXMuaW5wdXRFbGVtLnZhbHVlID09PSAnJykge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NldFN1Z2dlc3Rpb25zKFtdKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZXF1ZXN0U3VnZ2VzdGlvbnNUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3JlcXVlc3RTdWdnZXN0aW9ucygpO1xuICAgICAgICAgICAgICAgIH0sIHRoaXMuZGVib3VuY2VLZXlzdHJva2VzRGVsYXkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmlucHV0RWxlbS5hZGRFdmVudExpc3RlbmVyKCdmb2N1cycsICgpID0+IHRoaXMuX3VwZGF0ZUFyaWFTdGF0ZXMoKSk7XG4gICAgICAgIHRoaXMuaW5wdXRFbGVtLmFkZEV2ZW50TGlzdGVuZXIoJ2JsdXInLCAoKSA9PiB0aGlzLl91cGRhdGVBcmlhU3RhdGVzKCkpO1xuICAgIH1cblxuICAgIGFzeW5jIF9yZXF1ZXN0U3VnZ2VzdGlvbnMoKSB7XG4gICAgICAgIHRoaXMuY3VycmVudEFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcblxuICAgICAgICBjb25zdCBib2R5ID0ge1xuICAgICAgICAgICAgaW5wdXRWYWx1ZTogdGhpcy5pbnB1dEVsZW0udmFsdWUsXG4gICAgICAgICAgICBtYXhSZXN1bHRzOiB0aGlzLmdldEF0dHJpYnV0ZSgnZGF0YS1tYXgtc3VnZ2VzdGlvbnMnKSxcbiAgICAgICAgICAgIHNpbWlsYXJpdHlUaHJlc2hvbGQ6IHRoaXMuZ2V0QXR0cmlidXRlKCdkYXRhLXNpbWlsYXJpdHktdGhyZXNob2xkJyksXG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgYW50aWZvcmdlcnlOYW1lID0gdGhpcy5nZXRBdHRyaWJ1dGUoJ2RhdGEtYW50aWZvcmdlcnktbmFtZScpO1xuICAgICAgICBpZiAoYW50aWZvcmdlcnlOYW1lKSB7XG4gICAgICAgICAgICBib2R5W2FudGlmb3JnZXJ5TmFtZV0gPSB0aGlzLmdldEF0dHJpYnV0ZSgnZGF0YS1hbnRpZm9yZ2VyeS12YWx1ZScpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHJlc3BvbnNlOiBSZXNwb25zZTtcbiAgICAgICAgY29uc3QgcmVxdWVzdEluaXQ6IFJlcXVlc3RJbml0ID0ge1xuICAgICAgICAgICAgbWV0aG9kOiAncG9zdCcsXG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgJ2NvbnRlbnQtdHlwZSc6ICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGJvZHk6IG5ldyBVUkxTZWFyY2hQYXJhbXMoYm9keSksXG4gICAgICAgICAgICBzaWduYWw6IHRoaXMuY3VycmVudEFib3J0Q29udHJvbGxlci5zaWduYWwsXG4gICAgICAgIH07XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdlIHJlbHkgb24gdGhlIFVSTCBiZWluZyBwYXRoYmFzZS1yZWxhdGl2ZSBmb3IgQmxhem9yLCBvciBhIH4vLi4uIFVSTCB0aGF0IHdvdWxkIGFscmVhZHlcbiAgICAgICAgICAgIC8vIGJlIHJlc29sdmVkIG9uIHRoZSBzZXJ2ZXIgZm9yIE1WQ1xuICAgICAgICAgICAgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh0aGlzLmdldEF0dHJpYnV0ZSgnZGF0YS1zdWdnZXN0aW9ucy11cmwnKSwgcmVxdWVzdEluaXQpO1xuICAgICAgICAgICAgY29uc3Qgc3VnZ2VzdGlvbnM6IHN0cmluZ1tdID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgICAgICAgdGhpcy5fc2V0U3VnZ2VzdGlvbnMoc3VnZ2VzdGlvbnMpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChleCkge1xuICAgICAgICAgICAgaWYgKGV4IGluc3RhbmNlb2YgRE9NRXhjZXB0aW9uICYmIGV4Lm5hbWUgPT09ICdBYm9ydEVycm9yJykge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhyb3cgZXg7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfc2V0U3VnZ2VzdGlvbnMoc3VnZ2VzdGlvbnM6IHN0cmluZ1tdKSB7XG4gICAgICAgIHdoaWxlICh0aGlzLmZpcnN0RWxlbWVudENoaWxkKSB7XG4gICAgICAgICAgICB0aGlzLmZpcnN0RWxlbWVudENoaWxkLnJlbW92ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IG9wdGlvbkluZGV4ID0gMDtcbiAgICAgICAgc3VnZ2VzdGlvbnMuZm9yRWFjaChjaG9pY2UgPT4ge1xuICAgICAgICAgICAgY29uc3Qgb3B0aW9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgICAgICBvcHRpb24uaWQgPSBgJHt0aGlzLmlkfV9pdGVtJHtvcHRpb25JbmRleCsrfWA7XG4gICAgICAgICAgICBvcHRpb24uc2V0QXR0cmlidXRlKCdyb2xlJywgJ29wdGlvbicpO1xuICAgICAgICAgICAgb3B0aW9uLnNldEF0dHJpYnV0ZSgnYXJpYS1zZWxlY3RlZCcsICdmYWxzZScpO1xuICAgICAgICAgICAgb3B0aW9uLmNsYXNzTGlzdC5hZGQoJ3NtYXJ0Y29tYm9ib3gtc3VnZ2VzdGlvbicpO1xuICAgICAgICAgICAgb3B0aW9uLnRleHRDb250ZW50ID0gY2hvaWNlO1xuICAgICAgICAgICAgdGhpcy5hcHBlbmRDaGlsZChvcHRpb24pO1xuICAgICAgICB9KTtcblxuICAgICAgICBpZiAoc3VnZ2VzdGlvbnMubGVuZ3RoKSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVTZWxlY3Rpb24oeyBzdWdnZXN0aW9uOiB0aGlzLmNoaWxkcmVuWzBdIGFzIEhUTUxFbGVtZW50IH0pO1xuICAgICAgICAgICAgdGhpcy5zdHlsZS5kaXNwbGF5ID0gbnVsbDsgLy8gQWxsb3cgdmlzaWJpbGl0eSB0byBiZSBjb250cm9sbGVkIGJ5IGZvY3VzIHJ1bGUgaW4gQ1NTXG5cbiAgICAgICAgICAgIC8vIFdlIHJlbHkgb24gdGhlIGlucHV0IG5vdCBtb3ZpbmcgcmVsYXRpdmUgdG8gaXRzIG9mZnNldFBhcmVudCB3aGlsZSB0aGUgc3VnZ2VzdGlvbnNcbiAgICAgICAgICAgIC8vIGFyZSB2aXNpYmxlLiBEZXZlbG9wZXJzIGNhbiBhbHdheXMgcHV0IHRoZSBpbnB1dCBkaXJlY3RseSBpbnNpZGUgYSByZWxhdGl2ZWx5LXBvc2l0aW9uZWRcbiAgICAgICAgICAgIC8vIGNvbnRhaW5lciBpZiB0aGV5IG5lZWQgdGhpcyB0byB3b3JrIG9uIGEgZmluZS1ncmFpbmVkIGJhc2lzLlxuICAgICAgICAgICAgdGhpcy5zdHlsZS50b3AgPSB0aGlzLmlucHV0RWxlbS5vZmZzZXRUb3AgKyB0aGlzLmlucHV0RWxlbS5vZmZzZXRIZWlnaHQgKyAncHgnO1xuICAgICAgICAgICAgdGhpcy5zdHlsZS5sZWZ0ID0gdGhpcy5pbnB1dEVsZW0ub2Zmc2V0TGVmdCArICdweCc7XG4gICAgICAgICAgICB0aGlzLnN0eWxlLndpZHRoID0gdGhpcy5pbnB1dEVsZW0ub2Zmc2V0V2lkdGggKyAncHgnO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fdXBkYXRlQXJpYVN0YXRlcygpO1xuICAgIH1cblxuICAgIF91cGRhdGVBcmlhU3RhdGVzKCkge1xuICAgICAgICAvLyBhcmlhLWV4cGFuZGVkXG4gICAgICAgIGNvbnN0IGlzRXhwYW5kZWQgPSB0aGlzLmZpcnN0Q2hpbGQgJiYgZG9jdW1lbnQuYWN0aXZlRWxlbWVudCA9PT0gdGhpcy5pbnB1dEVsZW07XG4gICAgICAgIHRoaXMuaW5wdXRFbGVtLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsIGlzRXhwYW5kZWQgPyAndHJ1ZScgOiAnZmFsc2UnKTtcblxuICAgICAgICAvLyBhcmlhLWFjdGl2ZWRlc2NlbmRhbnRcbiAgICAgICAgY29uc3Qgc3VnZ2VzdGlvbiA9IGlzRXhwYW5kZWQgJiYgdGhpcy5jaGlsZHJlblt0aGlzLnNlbGVjdGVkSW5kZXhdIGFzIEhUTUxFbGVtZW50O1xuICAgICAgICBpZiAoIXN1Z2dlc3Rpb24pIHtcbiAgICAgICAgICAgIHRoaXMuaW5wdXRFbGVtLnJlbW92ZUF0dHJpYnV0ZSgnYXJpYS1hY3RpdmVkZXNjZW5kYW50Jyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmlucHV0RWxlbS5zZXRBdHRyaWJ1dGUoJ2FyaWEtYWN0aXZlZGVzY2VuZGFudCcsIHN1Z2dlc3Rpb24uaWQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2hhbmRsZVN1Z2dlc3Rpb25TZWxlY3RlZChzdWdnZXN0aW9uOiBIVE1MRWxlbWVudCkge1xuICAgICAgICB0aGlzLl91cGRhdGVTZWxlY3Rpb24oeyBzdWdnZXN0aW9uLCB1cGRhdGVJbnB1dFRvTWF0Y2g6IHRydWUgfSk7XG4gICAgICAgIHRoaXMuaW5wdXRFbGVtLmJsdXIoKTtcbiAgICB9XG5cbiAgICBfdXBkYXRlU2VsZWN0aW9uKG9wZXJhdGlvbjogeyBvZmZzZXQ/OiBudW1iZXIsIHN1Z2dlc3Rpb24/OiBIVE1MRWxlbWVudCwgdXBkYXRlSW5wdXRUb01hdGNoPzogYm9vbGVhbiB9KSB7XG4gICAgICAgIGxldCBzdWdnZXN0aW9uID0gb3BlcmF0aW9uLnN1Z2dlc3Rpb247XG4gICAgICAgIGlmIChzdWdnZXN0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLnNlbGVjdGVkSW5kZXggPSBBcnJheS5mcm9tKHRoaXMuY2hpbGRyZW4pLmluZGV4T2Yoc3VnZ2VzdGlvbik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoaXNOYU4ob3BlcmF0aW9uLm9mZnNldCkpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1N1cHBseSBlaXRoZXIgb2Zmc2V0IG9yIHNlbGVjdGlvbiBlbGVtZW50Jyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG5ld0luZGV4ID0gTWF0aC5tYXgoMCwgTWF0aC5taW4odGhpcy5jaGlsZHJlbi5sZW5ndGggLSAxLCB0aGlzLnNlbGVjdGVkSW5kZXggKyBvcGVyYXRpb24ub2Zmc2V0KSk7XG4gICAgICAgICAgICBpZiAobmV3SW5kZXggPT09IHRoaXMuc2VsZWN0ZWRJbmRleCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5zZWxlY3RlZEluZGV4ID0gbmV3SW5kZXg7XG4gICAgICAgICAgICBzdWdnZXN0aW9uID0gdGhpcy5jaGlsZHJlbltuZXdJbmRleF0gYXMgSFRNTEVsZW1lbnQ7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwcmV2U2VsZWN0ZWRTdWdnZXN0aW9uID0gdGhpcy5xdWVyeVNlbGVjdG9yKCcuc2VsZWN0ZWQnKTtcbiAgICAgICAgaWYgKHByZXZTZWxlY3RlZFN1Z2dlc3Rpb24gPT09IHN1Z2dlc3Rpb24gJiYgdGhpcy5pbnB1dEVsZW0udmFsdWUgPT09IHN1Z2dlc3Rpb24udGV4dENvbnRlbnQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHByZXZTZWxlY3RlZFN1Z2dlc3Rpb24/LnNldEF0dHJpYnV0ZSgnYXJpYS1zZWxlY3RlZCcsICdmYWxzZScpO1xuICAgICAgICBwcmV2U2VsZWN0ZWRTdWdnZXN0aW9uPy5jbGFzc0xpc3QucmVtb3ZlKCdzZWxlY3RlZCcpO1xuICAgICAgICBzdWdnZXN0aW9uLnNldEF0dHJpYnV0ZSgnYXJpYS1zZWxlY3RlZCcsICd0cnVlJyk7XG4gICAgICAgIHN1Z2dlc3Rpb24uY2xhc3NMaXN0LmFkZCgnc2VsZWN0ZWQnKTtcblxuICAgICAgICBpZiAoc3VnZ2VzdGlvblsnc2Nyb2xsSW50b1ZpZXdJZk5lZWRlZCddKSB7XG4gICAgICAgICAgICBzdWdnZXN0aW9uWydzY3JvbGxJbnRvVmlld0lmTmVlZGVkJ10oZmFsc2UpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gRmlyZWZveCBkb2Vzbid0IHN1cHBvcnQgc2Nyb2xsSW50b1ZpZXdJZk5lZWRlZCwgc28gd2UgZmFsbCBiYWNrIG9uIHNjcm9sbEludG9WaWV3LlxuICAgICAgICAgICAgLy8gVGhpcyB3aWxsIGFsaWduIHRoZSB0b3Agb2YgdGhlIHN1Z2dlc3Rpb24gd2l0aCB0aGUgdG9wIG9mIHRoZSBzY3JvbGxhYmxlIGFyZWEuXG4gICAgICAgICAgICBzdWdnZXN0aW9uLnNjcm9sbEludG9WaWV3KCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl91cGRhdGVBcmlhU3RhdGVzKCk7XG5cbiAgICAgICAgaWYgKG9wZXJhdGlvbi51cGRhdGVJbnB1dFRvTWF0Y2gpIHtcbiAgICAgICAgICAgIHNldEZvcm1FbGVtZW50VmFsdWVXaXRoRXZlbnRzKHRoaXMuaW5wdXRFbGVtLCBzdWdnZXN0aW9uLnRleHRDb250ZW50IHx8ICcnKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsImltcG9ydCB7IGlzQ29tYm9Cb3gsIHNldEZvcm1FbGVtZW50VmFsdWVXaXRoRXZlbnRzIH0gZnJvbSAnLi9Gb3JtVXRpbCc7XG5cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlclNtYXJ0UGFzdGVDbGlja0hhbmRsZXIoKSB7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZXZ0KSA9PiB7XG4gICAgICAgIGNvbnN0IHRhcmdldCA9IGV2dC50YXJnZXQ7XG4gICAgICAgIGlmICh0YXJnZXQgaW5zdGFuY2VvZiBFbGVtZW50KSB7XG4gICAgICAgICAgICBjb25zdCBidXR0b24gPSB0YXJnZXQuY2xvc2VzdCgnYnV0dG9uW2RhdGEtc21hcnQtcGFzdGUtdHJpZ2dlcj10cnVlXScpO1xuICAgICAgICAgICAgaWYgKGJ1dHRvbiBpbnN0YW5jZW9mIEhUTUxCdXR0b25FbGVtZW50KSB7XG4gICAgICAgICAgICAgICAgcGVyZm9ybVNtYXJ0UGFzdGUoYnV0dG9uKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG5hc3luYyBmdW5jdGlvbiBwZXJmb3JtU21hcnRQYXN0ZShidXR0b246IEhUTUxCdXR0b25FbGVtZW50KSB7XG4gICAgY29uc3QgZm9ybSA9IGJ1dHRvbi5jbG9zZXN0KCdmb3JtJyk7XG4gICAgaWYgKCFmb3JtKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Egc21hcnQgcGFzdGUgYnV0dG9uIHdhcyBjbGlja2VkLCBidXQgaXQgaXMgbm90IGluc2lkZSBhIGZvcm0nKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGZvcm1Db25maWcgPSBleHRyYWN0Rm9ybUNvbmZpZyhmb3JtKTtcbiAgICBpZiAoZm9ybUNvbmZpZy5sZW5ndGggPT0gMCkge1xuICAgICAgICBjb25zb2xlLndhcm4oJ0Egc21hcnQgcGFzdGUgYnV0dG9uIHdhcyBjbGlja2VkLCBidXQgbm8gZmllbGRzIHdlcmUgZm91bmQgaW4gaXRzIGZvcm0nKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGNsaXBib2FyZENvbnRlbnRzID0gYXdhaXQgcmVhZENsaXBib2FyZFRleHQoKTtcbiAgICBpZiAoIWNsaXBib2FyZENvbnRlbnRzKSB7XG4gICAgICAgIGNvbnNvbGUuaW5mbygnQSBzbWFydCBwYXN0ZSBidXR0b24gd2FzIGNsaWNrZWQsIGJ1dCBubyBkYXRhIHdhcyBmb3VuZCBvbiB0aGUgY2xpcGJvYXJkJyk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgICBidXR0b24uZGlzYWJsZWQgPSB0cnVlO1xuICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGdldFNtYXJ0UGFzdGVSZXNwb25zZShidXR0b24sIGZvcm1Db25maWcsIGNsaXBib2FyZENvbnRlbnRzKTtcbiAgICAgICAgY29uc3QgcmVzcG9uc2VUZXh0ID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpO1xuICAgICAgICBwb3B1bGF0ZUZvcm0oZm9ybSwgZm9ybUNvbmZpZywgcmVzcG9uc2VUZXh0KTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgICBidXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHBvcHVsYXRlRm9ybShmb3JtOiBIVE1MRm9ybUVsZW1lbnQsIGZvcm1Db25maWc6IEZpZWxkQ29uZmlnW10sIHJlc3BvbnNlVGV4dDogc3RyaW5nKSB7XG4gICAgbGV0IHJlc3VsdERhdGE6IGFueTtcbiAgICB0cnkge1xuICAgICAgICByZXN1bHREYXRhID0gSlNPTi5wYXJzZShyZXNwb25zZVRleHQpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZm9ybUNvbmZpZy5mb3JFYWNoKGZpZWxkID0+IHtcbiAgICAgICAgLy8gRm9yIG1pc3NpbmcgZmllbGRzLCBpdCdzIHVzdWFsbHkgYmV0dGVyIHRvIGxlYXZlIHRoZSBleGlzdGluZyBmaWVsZCBkYXRhIGluIHBsYWNlLCBzaW5jZSB0aGVyZVxuICAgICAgICAvLyBtaWdodCBiZSB1c2VmdWwgdmFsdWVzIGluIHVucmVsYXRlZCBmaWVsZHMuIEl0IHdvdWxkIGJlIG5pY2UgaWYgdGhlIGluZmVyZW5jZSBjb3VsZCBjb25jbHVzaXZlbHlcbiAgICAgICAgLy8gZGV0ZXJtaW5lIGNhc2VzIHdoZW4gYSBmaWVsZCBzaG91bGQgYmUgY2xlYXJlZCwgYnV0IGluIG1vc3QgY2FzZXMgaXQgY2FuJ3QgZGlzdGluZ3Vpc2ggXCJub1xuICAgICAgICAvLyBpbmZvcm1hdGlvbiBhdmFpbGFibGVcIiBmcm9tIFwidGhlIHZhbHVlIHNob3VsZCBkZWZpbml0ZWx5IGJlIGJsYW5rZWQgb3V0XCIuXG4gICAgICAgIGxldCB2YWx1ZSA9IHJlc3VsdERhdGFbZmllbGQuaWRlbnRpZmllcl07XG4gICAgICAgIGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IHZhbHVlLnRvU3RyaW5nKCkudHJpbSgpO1xuICAgICAgICAgICAgaWYgKGZpZWxkLmVsZW1lbnQgaW5zdGFuY2VvZiBIVE1MSW5wdXRFbGVtZW50ICYmIGZpZWxkLmVsZW1lbnQudHlwZSA9PT0gJ3JhZGlvJykge1xuICAgICAgICAgICAgICAgIC8vIFJhZGlvIGlzIGEgYml0IG1vcmUgY29tcGxleCB0aGFuIHRoZSBvdGhlcnMgYXMgaXQncyBub3QganVzdCBhIHNpbmdsZSBmb3JtIGVsZW1lbnRcbiAgICAgICAgICAgICAgICAvLyBXZSBoYXZlIHRvIGZpbmQgdGhlIG9uZSBjb3JyZXNwb25kaW5nIHRvIHRoZSBuZXcgdmFsdWUsIHdoaWNoIGluIHR1cm4gZGVwZW5kcyBvblxuICAgICAgICAgICAgICAgIC8vIGhvdyB3ZSdyZSBpbnRlcnByZXRpbmcgdGhlIGZpZWxkIGRlc2NyaXB0aW9uXG4gICAgICAgICAgICAgICAgY29uc3QgcmFkaW9JbnB1dFRvU2VsZWN0ID0gZmluZElucHV0UmFkaW9CeVRleHQoZm9ybSwgZmllbGQuZWxlbWVudC5uYW1lLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgaWYgKHJhZGlvSW5wdXRUb1NlbGVjdCkge1xuICAgICAgICAgICAgICAgICAgICBzZXRGb3JtRWxlbWVudFZhbHVlV2l0aEV2ZW50cyhyYWRpb0lucHV0VG9TZWxlY3QsIHRydWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc2V0Rm9ybUVsZW1lbnRWYWx1ZVdpdGhFdmVudHMoZmllbGQuZWxlbWVudCwgdmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIGZpbmRJbnB1dFJhZGlvQnlUZXh0KGZvcm06IEhUTUxGb3JtRWxlbWVudCwgcmFkaW9Hcm91cE5hbWU6IHN0cmluZywgdmFsdWVUZXh0OiBzdHJpbmcpOiBIVE1MSW5wdXRFbGVtZW50IHwgbnVsbCB7XG4gICAgY29uc3QgY2FuZGlkYXRlcyA9IEFycmF5LmZyb20oZm9ybS5xdWVyeVNlbGVjdG9yQWxsKCdpbnB1dFt0eXBlPXJhZGlvXScpKVxuICAgICAgICAuZmlsdGVyKGUgPT4gZSBpbnN0YW5jZW9mIEhUTUxJbnB1dEVsZW1lbnQgJiYgZS5uYW1lID09PSByYWRpb0dyb3VwTmFtZSlcbiAgICAgICAgLm1hcChlID0+ICh7IGVsZW06IGUgYXMgSFRNTElucHV0RWxlbWVudCwgdGV4dDogaW5mZXJGaWVsZERlc2NyaXB0aW9uKGZvcm0sIGUgYXMgSFRNTElucHV0RWxlbWVudCkgfSkpO1xuICAgIGNvbnN0IGV4YWN0TWF0Y2hlcyA9IGNhbmRpZGF0ZXMuZmlsdGVyKG8gPT4gby50ZXh0ID09PSB2YWx1ZVRleHQpO1xuICAgIGlmIChleGFjdE1hdGNoZXMubGVuZ3RoID4gMCkge1xuICAgICAgICByZXR1cm4gZXhhY3RNYXRjaGVzWzBdLmVsZW07XG4gICAgfVxuXG4gICAgY29uc3QgcGFydGlhbE1hdGNoZXMgPSBjYW5kaWRhdGVzLmZpbHRlcihvID0+IG8udGV4dCAmJiBvLnRleHQuaW5kZXhPZih2YWx1ZVRleHQpID49IDApO1xuICAgIGlmIChwYXJ0aWFsTWF0Y2hlcy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgcmV0dXJuIHBhcnRpYWxNYXRjaGVzWzBdLmVsZW07XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJlYWRDbGlwYm9hcmRUZXh0KCk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuICAgIGNvbnN0IGZha2UgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmFrZS1jbGlwYm9hcmQnKSBhcyBIVE1MSW5wdXRFbGVtZW50O1xuICAgIGlmIChmYWtlPy52YWx1ZSkge1xuICAgICAgICByZXR1cm4gZmFrZS52YWx1ZTtcbiAgICB9XG5cbiAgICBpZiAoIW5hdmlnYXRvci5jbGlwYm9hcmQucmVhZFRleHQpIHtcbiAgICAgICAgYWxlcnQoJ1RoZSBjdXJyZW50IGJyb3dzZXIgZG9lcyBub3Qgc3VwcG9ydCByZWFkaW5nIHRoZSBjbGlwYm9hcmQuXFxuXFxuVE9ETzogSW1wbGVtZW50IGFsdGVybmF0ZSBVSSBmb3IgdGhpcyBjYXNlLicpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4gbmF2aWdhdG9yLmNsaXBib2FyZC5yZWFkVGV4dCgpO1xufVxuXG5mdW5jdGlvbiBleHRyYWN0Rm9ybUNvbmZpZyhmb3JtOiBIVE1MRm9ybUVsZW1lbnQpOiBGaWVsZENvbmZpZ1tdIHtcbiAgICBjb25zdCBmaWVsZHM6IEZpZWxkQ29uZmlnW10gPSBbXTtcbiAgICBsZXQgdW5pZGVudGlmaWVkQ291bnQgPSAwO1xuICAgIGZvcm0ucXVlcnlTZWxlY3RvckFsbCgnaW5wdXQsIHNlbGVjdCwgdGV4dGFyZWEnKS5mb3JFYWNoKGVsZW1lbnQgPT4ge1xuICAgICAgICBpZiAoIShlbGVtZW50IGluc3RhbmNlb2YgSFRNTElucHV0RWxlbWVudCB8fCBlbGVtZW50IGluc3RhbmNlb2YgSFRNTFNlbGVjdEVsZW1lbnQgfHwgZWxlbWVudCBpbnN0YW5jZW9mIEhUTUxUZXh0QXJlYUVsZW1lbnQpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZWxlbWVudC50eXBlID09PSAnaGlkZGVuJyB8fCBpc0NvbWJvQm94KGVsZW1lbnQpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpc1JhZGlvID0gZWxlbWVudC50eXBlID09PSAncmFkaW8nO1xuICAgICAgICBjb25zdCBpZGVudGlmaWVyID0gaXNSYWRpb1xuICAgICAgICAgICAgPyBlbGVtZW50Lm5hbWVcbiAgICAgICAgICAgIDogZWxlbWVudC5pZCB8fCBlbGVtZW50Lm5hbWUgfHwgYHVuaWRlbnRpZmllZF8keysrdW5pZGVudGlmaWVkQ291bnR9YDtcblxuICAgICAgICAvLyBPbmx5IGluY2x1ZGUgb25lIGZpZWxkIGZvciBlYWNoIHJlbGF0ZWQgc2V0IG9mIHJhZGlvIGJ1dHRvbnNcbiAgICAgICAgaWYgKGlzUmFkaW8gJiYgZmllbGRzLmZpbmQoZiA9PiBmLmlkZW50aWZpZXIgPT09IGlkZW50aWZpZXIpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgZGVzY3JpcHRpb246IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICAgICAgICBpZiAoIWlzUmFkaW8pIHtcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uID0gaW5mZXJGaWVsZERlc2NyaXB0aW9uKGZvcm0sIGVsZW1lbnQpO1xuICAgICAgICAgICAgaWYgKCFkZXNjcmlwdGlvbikge1xuICAgICAgICAgICAgICAgIC8vIElmIHdlIGNhbid0IHNheSBhbnl0aGluZyBhYm91dCB3aGF0IHRoaXMgZmllbGQgcmVwcmVzZW50cywgd2UgaGF2ZSB0byBleGNsdWRlIGl0XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZmllbGRFbnRyeTogRmllbGRDb25maWcgPSB7XG4gICAgICAgICAgICBpZGVudGlmaWVyOiBpZGVudGlmaWVyLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGRlc2NyaXB0aW9uLFxuICAgICAgICAgICAgZWxlbWVudDogZWxlbWVudCxcbiAgICAgICAgICAgIHR5cGU6IGVsZW1lbnQudHlwZSA9PT0gJ2NoZWNrYm94JyA/ICdib29sZWFuJ1xuICAgICAgICAgICAgICAgIDogZWxlbWVudC50eXBlID09PSAnbnVtYmVyJyA/ICdudW1iZXInIDogJ3N0cmluZycsXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBIVE1MU2VsZWN0RWxlbWVudCkge1xuICAgICAgICAgICAgY29uc3Qgb3B0aW9ucyA9IEFycmF5LnByb3RvdHlwZS5maWx0ZXIuY2FsbChlbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ29wdGlvbicpLCBvID0+ICEhby52YWx1ZSk7XG4gICAgICAgICAgICBmaWVsZEVudHJ5LmFsbG93ZWRWYWx1ZXMgPSBBcnJheS5wcm90b3R5cGUubWFwLmNhbGwob3B0aW9ucywgbyA9PiBvLnRleHRDb250ZW50KTtcbiAgICAgICAgICAgIGZpZWxkRW50cnkudHlwZSA9ICdmaXhlZC1jaG9pY2VzJztcbiAgICAgICAgfSBlbHNlIGlmIChpc1JhZGlvKSB7XG4gICAgICAgICAgICBmaWVsZEVudHJ5LmFsbG93ZWRWYWx1ZXMgPSBbXTtcbiAgICAgICAgICAgIGZpZWxkRW50cnkudHlwZSA9ICdmaXhlZC1jaG9pY2VzJztcbiAgICAgICAgICAgIEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwoZm9ybS5xdWVyeVNlbGVjdG9yQWxsKCdpbnB1dFt0eXBlPXJhZGlvXScpLCBlID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZS5uYW1lID09PSBpZGVudGlmaWVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNob2ljZURlc2NyaXB0aW9uID0gaW5mZXJGaWVsZERlc2NyaXB0aW9uKGZvcm0sIGUpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY2hvaWNlRGVzY3JpcHRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkRW50cnkuYWxsb3dlZFZhbHVlcyEucHVzaChjaG9pY2VEZXNjcmlwdGlvbik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZpZWxkcy5wdXNoKGZpZWxkRW50cnkpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGZpZWxkcztcbn1cblxuZnVuY3Rpb24gaW5mZXJGaWVsZERlc2NyaXB0aW9uKGZvcm06IEhUTUxGb3JtRWxlbWVudCwgZWxlbWVudDogSFRNTEVsZW1lbnQpOiBzdHJpbmcgfCBudWxsIHtcbiAgICAvLyBJZiB0aGVyZSdzIGV4cGxpY2l0IGNvbmZpZywgdXNlIGl0XG4gICAgY29uc3Qgc21hcnRQYXN0ZURlc2NyaXB0aW9uID0gZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtc21hcnRwYXN0ZS1kZXNjcmlwdGlvbicpO1xuICAgIGlmIChzbWFydFBhc3RlRGVzY3JpcHRpb24pIHtcbiAgICAgICAgcmV0dXJuIHNtYXJ0UGFzdGVEZXNjcmlwdGlvbjtcbiAgICB9XG5cbiAgICAvLyBJZiB0aGVyZSdzIGFuIGV4cGxpY2l0IGxhYmVsLCB1c2UgaXRcbiAgICBjb25zdCBsYWJlbHMgPSBlbGVtZW50LmlkICYmIGZvcm0ucXVlcnlTZWxlY3RvckFsbChgbGFiZWxbZm9yPScke2VsZW1lbnQuaWR9J11gKTtcbiAgICBpZiAobGFiZWxzICYmIGxhYmVscy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgcmV0dXJuIGxhYmVsc1swXS50ZXh0Q29udGVudC50cmltKCk7XG4gICAgfVxuXG4gICAgLy8gVHJ5IHNlYXJjaGluZyB1cCB0aGUgRE9NIGhpZXJhcmNoeSB0byBsb29rIGZvciBzb21lIGNvbnRhaW5lciB0aGF0IG9ubHkgY29udGFpbnNcbiAgICAvLyB0aGlzIG9uZSBmaWVsZCBhbmQgaGFzIHRleHRcbiAgICBsZXQgY2FuZGlkYXRlQ29udGFpbmVyID0gZWxlbWVudC5wYXJlbnRFbGVtZW50O1xuICAgIHdoaWxlIChjYW5kaWRhdGVDb250YWluZXIgJiYgY2FuZGlkYXRlQ29udGFpbmVyICE9PSBmb3JtLnBhcmVudEVsZW1lbnQpIHtcbiAgICAgICAgY29uc3QgaW5wdXRzSW5Db250YWluZXIgPSBjYW5kaWRhdGVDb250YWluZXIucXVlcnlTZWxlY3RvckFsbCgnaW5wdXQsIHNlbGVjdCwgdGV4dGFyZWEnKTtcbiAgICAgICAgaWYgKGlucHV0c0luQ29udGFpbmVyLmxlbmd0aCA9PT0gMSAmJiBpbnB1dHNJbkNvbnRhaW5lclswXSA9PT0gZWxlbWVudCkge1xuICAgICAgICAgICAgLy8gSGVyZSdzIGEgY29udGFpbmVyIGluIHdoaWNoIHRoaXMgZWxlbWVudCBpcyB0aGUgb25seSBpbnB1dC4gQW55IHRleHQgaGVyZVxuICAgICAgICAgICAgLy8gd2lsbCBiZSBhc3N1bWVkIHRvIGRlc2NyaWJlIHRoZSBpbnB1dC5cbiAgICAgICAgICAgIGxldCB0ZXh0ID0gY2FuZGlkYXRlQ29udGFpbmVyLnRleHRDb250ZW50LnJlcGxhY2UoL1xccysvZywgJyAnKS50cmltKCk7XG4gICAgICAgICAgICBpZiAodGV4dCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0ZXh0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY2FuZGlkYXRlQ29udGFpbmVyID0gY2FuZGlkYXRlQ29udGFpbmVyLnBhcmVudEVsZW1lbnQ7XG4gICAgfVxuXG4gICAgLy8gRmFsbCBiYWNrIG9uIG5hbWUgKGJlY2F1c2UgdGhhdCdzIHdoYXQgd291bGQgYmUgYm91bmQgb24gdGhlIHNlcnZlcikgb3IgZXZlbiBJRFxuICAgIC8vIElmIGV2ZW4gdGhlc2UgaGF2ZSBubyBkYXRhLCB3ZSB3b24ndCBiZSBhYmxlIHRvIHVzZSB0aGUgZmllbGRcbiAgICByZXR1cm4gZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ25hbWUnKSB8fCBlbGVtZW50LmlkO1xufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRTbWFydFBhc3RlUmVzcG9uc2UoYnV0dG9uOiBIVE1MQnV0dG9uRWxlbWVudCwgZm9ybUNvbmZpZywgY2xpcGJvYXJkQ29udGVudHMpOiBQcm9taXNlPFJlc3BvbnNlPiB7XG4gICAgY29uc3QgZm9ybUZpZWxkcyA9IGZvcm1Db25maWcubWFwKGVudHJ5ID0+IHJlc3RyaWN0UHJvcGVydGllcyhlbnRyeSwgWydpZGVudGlmaWVyJywgJ2Rlc2NyaXB0aW9uJywgJ2FsbG93ZWRWYWx1ZXMnLCAndHlwZSddKSk7XG5cbiAgICBjb25zdCBib2R5ID0ge1xuICAgICAgICBkYXRhSnNvbjogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgZm9ybUZpZWxkcyxcbiAgICAgICAgICAgIGNsaXBib2FyZENvbnRlbnRzLFxuICAgICAgICB9KVxuICAgIH07XG5cbiAgICBjb25zdCBhbnRpZm9yZ2VyeU5hbWUgPSBidXR0b24uZ2V0QXR0cmlidXRlKCdkYXRhLWFudGlmb3JnZXJ5LW5hbWUnKTtcbiAgICBpZiAoYW50aWZvcmdlcnlOYW1lKSB7XG4gICAgICAgIGJvZHlbYW50aWZvcmdlcnlOYW1lXSA9IGJ1dHRvbi5nZXRBdHRyaWJ1dGUoJ2RhdGEtYW50aWZvcmdlcnktdmFsdWUnKTtcbiAgICB9XG5cbiAgICAvLyBXZSByZWx5IG9uIHRoZSBVUkwgYmVpbmcgcGF0aGJhc2UtcmVsYXRpdmUgZm9yIEJsYXpvciwgb3IgYSB+Ly4uLiBVUkwgdGhhdCB3b3VsZCBhbHJlYWR5XG4gICAgLy8gYmUgcmVzb2x2ZWQgb24gdGhlIHNlcnZlciBmb3IgTVZDXG4gICAgY29uc3QgdXJsID0gYnV0dG9uLmdldEF0dHJpYnV0ZSgnZGF0YS11cmwnKTtcbiAgICByZXR1cm4gZmV0Y2godXJsLCB7XG4gICAgICAgIG1ldGhvZDogJ3Bvc3QnLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZCcsXG4gICAgICAgIH0sXG4gICAgICAgIGJvZHk6IG5ldyBVUkxTZWFyY2hQYXJhbXMoYm9keSlcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gcmVzdHJpY3RQcm9wZXJ0aWVzKG9iamVjdCwgcHJvcGVydHlOYW1lcykge1xuICAgIGNvbnN0IHJlc3VsdCA9IHt9O1xuICAgIHByb3BlcnR5TmFtZXMuZm9yRWFjaChwcm9wZXJ0eU5hbWUgPT4ge1xuICAgICAgICBjb25zdCB2YWx1ZSA9IG9iamVjdFtwcm9wZXJ0eU5hbWVdO1xuICAgICAgICBpZiAodmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmVzdWx0W3Byb3BlcnR5TmFtZV0gPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbmludGVyZmFjZSBGaWVsZENvbmZpZyB7XG4gICAgaWRlbnRpZmllcjogc3RyaW5nO1xuICAgIGRlc2NyaXB0aW9uOiBzdHJpbmcgfCBudWxsO1xuICAgIGVsZW1lbnQ6IEhUTUxJbnB1dEVsZW1lbnQgfCBIVE1MU2VsZWN0RWxlbWVudCB8IEhUTUxUZXh0QXJlYUVsZW1lbnQ7XG4gICAgdHlwZTogJ3N0cmluZycgfCAnYm9vbGVhbicgfCAnbnVtYmVyJyB8ICdmaXhlZC1jaG9pY2VzJztcbiAgICBhbGxvd2VkVmFsdWVzPzogc3RyaW5nW107XG59XG4iLCJ2YXIgYXR0cmlidXRlcyA9IFsnYm9yZGVyQm90dG9tV2lkdGgnLCAnYm9yZGVyTGVmdFdpZHRoJywgJ2JvcmRlclJpZ2h0V2lkdGgnLCAnYm9yZGVyVG9wU3R5bGUnLCAnYm9yZGVyUmlnaHRTdHlsZScsICdib3JkZXJCb3R0b21TdHlsZScsICdib3JkZXJMZWZ0U3R5bGUnLCAnYm9yZGVyVG9wV2lkdGgnLCAnYm94U2l6aW5nJywgJ2ZvbnRGYW1pbHknLCAnZm9udFNpemUnLCAnZm9udFdlaWdodCcsICdoZWlnaHQnLCAnbGV0dGVyU3BhY2luZycsICdsaW5lSGVpZ2h0JywgJ21hcmdpbkJvdHRvbScsICdtYXJnaW5MZWZ0JywgJ21hcmdpblJpZ2h0JywgJ21hcmdpblRvcCcsICdvdXRsaW5lV2lkdGgnLCAnb3ZlcmZsb3cnLCAnb3ZlcmZsb3dYJywgJ292ZXJmbG93WScsICdwYWRkaW5nQm90dG9tJywgJ3BhZGRpbmdMZWZ0JywgJ3BhZGRpbmdSaWdodCcsICdwYWRkaW5nVG9wJywgJ3RleHRBbGlnbicsICd0ZXh0T3ZlcmZsb3cnLCAndGV4dFRyYW5zZm9ybScsICd3aGl0ZVNwYWNlJywgJ3dvcmRCcmVhaycsICd3b3JkV3JhcCddO1xuLyoqXG4gKiBDcmVhdGUgYSBtaXJyb3JcbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsZW1lbnQgVGhlIGVsZW1lbnRcbiAqIEBwYXJhbSB7c3RyaW5nfSBodG1sIFRoZSBodG1sXG4gKlxuICogQHJldHVybiB7b2JqZWN0fSBUaGUgbWlycm9yIG9iamVjdFxuICovXG5cbnZhciBjcmVhdGVNaXJyb3IgPSBmdW5jdGlvbiBjcmVhdGVNaXJyb3IoZWxlbWVudCwgaHRtbCkge1xuICAvKipcbiAgICogVGhlIG1pcnJvciBlbGVtZW50XG4gICAqL1xuICB2YXIgbWlycm9yID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIC8qKlxuICAgKiBDcmVhdGUgdGhlIENTUyBmb3IgdGhlIG1pcnJvciBvYmplY3RcbiAgICpcbiAgICogQHJldHVybiB7b2JqZWN0fSBUaGUgc3R5bGUgb2JqZWN0XG4gICAqL1xuXG4gIHZhciBtaXJyb3JDc3MgPSBmdW5jdGlvbiBtaXJyb3JDc3MoKSB7XG4gICAgdmFyIGNzcyA9IHtcbiAgICAgIHBvc2l0aW9uOiAnYWJzb2x1dGUnLFxuICAgICAgbGVmdDogLTk5OTksXG4gICAgICB0b3A6IDAsXG4gICAgICB6SW5kZXg6IC0yMDAwXG4gICAgfTtcblxuICAgIGlmIChlbGVtZW50LnRhZ05hbWUgPT09ICdURVhUQVJFQScpIHtcbiAgICAgIGF0dHJpYnV0ZXMucHVzaCgnd2lkdGgnKTtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVzLmZvckVhY2goZnVuY3Rpb24gKGF0dHIpIHtcbiAgICAgIGNzc1thdHRyXSA9IGdldENvbXB1dGVkU3R5bGUoZWxlbWVudClbYXR0cl07XG4gICAgfSk7XG4gICAgcmV0dXJuIGNzcztcbiAgfTtcbiAgLyoqXG4gICAqIEluaXRpYWxpemUgdGhlIG1pcnJvclxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gaHRtbCBUaGUgaHRtbFxuICAgKlxuICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgKi9cblxuXG4gIHZhciBpbml0aWFsaXplID0gZnVuY3Rpb24gaW5pdGlhbGl6ZShodG1sKSB7XG4gICAgdmFyIHN0eWxlcyA9IG1pcnJvckNzcygpO1xuICAgIE9iamVjdC5rZXlzKHN0eWxlcykuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICBtaXJyb3Iuc3R5bGVba2V5XSA9IHN0eWxlc1trZXldO1xuICAgIH0pO1xuICAgIG1pcnJvci5pbm5lckhUTUwgPSBodG1sO1xuICAgIGVsZW1lbnQucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUobWlycm9yLCBlbGVtZW50Lm5leHRTaWJsaW5nKTtcbiAgfTtcbiAgLyoqXG4gICAqIEdldCB0aGUgcmVjdFxuICAgKlxuICAgKiBAcmV0dXJuIHtSZWN0fSBUaGUgYm91bmRpbmcgcmVjdFxuICAgKi9cblxuXG4gIHZhciByZWN0ID0gZnVuY3Rpb24gcmVjdCgpIHtcbiAgICB2YXIgbWFya2VyID0gbWlycm9yLm93bmVyRG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcmV0LXBvc2l0aW9uLW1hcmtlcicpO1xuICAgIHZhciBib3VuZGluZ1JlY3QgPSB7XG4gICAgICBsZWZ0OiBtYXJrZXIub2Zmc2V0TGVmdCxcbiAgICAgIHRvcDogbWFya2VyLm9mZnNldFRvcCxcbiAgICAgIGhlaWdodDogbWFya2VyLm9mZnNldEhlaWdodFxuICAgIH07XG4gICAgbWlycm9yLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQobWlycm9yKTtcbiAgICByZXR1cm4gYm91bmRpbmdSZWN0O1xuICB9O1xuXG4gIGluaXRpYWxpemUoaHRtbCk7XG4gIHJldHVybiB7XG4gICAgcmVjdDogcmVjdFxuICB9O1xufTtcblxuZnVuY3Rpb24gX3R5cGVvZihvYmopIHtcbiAgXCJAYmFiZWwvaGVscGVycyAtIHR5cGVvZlwiO1xuXG4gIGlmICh0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIFN5bWJvbC5pdGVyYXRvciA9PT0gXCJzeW1ib2xcIikge1xuICAgIF90eXBlb2YgPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgICByZXR1cm4gdHlwZW9mIG9iajtcbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIF90eXBlb2YgPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgICByZXR1cm4gb2JqICYmIHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiBvYmouY29uc3RydWN0b3IgPT09IFN5bWJvbCAmJiBvYmogIT09IFN5bWJvbC5wcm90b3R5cGUgPyBcInN5bWJvbFwiIDogdHlwZW9mIG9iajtcbiAgICB9O1xuICB9XG5cbiAgcmV0dXJuIF90eXBlb2Yob2JqKTtcbn1cblxuLyoqXG4gKiBDaGVjayBpZiBhIERPTSBFbGVtZW50IGlzIGNvbnRlbnQgZWRpdGFibGVcbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsZW1lbnQgIFRoZSBET00gZWxlbWVudFxuICpcbiAqIEByZXR1cm4ge2Jvb2x9IElmIGl0IGlzIGNvbnRlbnQgZWRpdGFibGVcbiAqL1xudmFyIGlzQ29udGVudEVkaXRhYmxlID0gZnVuY3Rpb24gaXNDb250ZW50RWRpdGFibGUoZWxlbWVudCkge1xuICByZXR1cm4gISEoZWxlbWVudC5jb250ZW50RWRpdGFibGUgPyBlbGVtZW50LmNvbnRlbnRFZGl0YWJsZSA9PT0gJ3RydWUnIDogZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2NvbnRlbnRlZGl0YWJsZScpID09PSAndHJ1ZScpO1xufTtcbi8qKlxuICogR2V0IHRoZSBjb250ZXh0IGZyb20gc2V0dGluZ3MgcGFzc2VkIGluXG4gKlxuICogQHBhcmFtIHtvYmplY3R9IHNldHRpbmdzIFRoZSBzZXR0aW5ncyBvYmplY3RcbiAqXG4gKiBAcmV0dXJuIHtvYmplY3R9IHdpbmRvdyBhbmQgZG9jdW1lbnRcbiAqL1xuXG52YXIgZ2V0Q29udGV4dCA9IGZ1bmN0aW9uIGdldENvbnRleHQoKSB7XG4gIHZhciBzZXR0aW5ncyA9IGFyZ3VtZW50cy5sZW5ndGggPiAwICYmIGFyZ3VtZW50c1swXSAhPT0gdW5kZWZpbmVkID8gYXJndW1lbnRzWzBdIDoge307XG4gIHZhciBjdXN0b21Qb3MgPSBzZXR0aW5ncy5jdXN0b21Qb3MsXG4gICAgICBpZnJhbWUgPSBzZXR0aW5ncy5pZnJhbWUsXG4gICAgICBub1NoYWRvd0NhcmV0ID0gc2V0dGluZ3Mubm9TaGFkb3dDYXJldDtcblxuICBpZiAoaWZyYW1lKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGlmcmFtZTogaWZyYW1lLFxuICAgICAgd2luZG93OiBpZnJhbWUuY29udGVudFdpbmRvdyxcbiAgICAgIGRvY3VtZW50OiBpZnJhbWUuY29udGVudERvY3VtZW50IHx8IGlmcmFtZS5jb250ZW50V2luZG93LmRvY3VtZW50LFxuICAgICAgbm9TaGFkb3dDYXJldDogbm9TaGFkb3dDYXJldCxcbiAgICAgIGN1c3RvbVBvczogY3VzdG9tUG9zXG4gICAgfTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgd2luZG93OiB3aW5kb3csXG4gICAgZG9jdW1lbnQ6IGRvY3VtZW50LFxuICAgIG5vU2hhZG93Q2FyZXQ6IG5vU2hhZG93Q2FyZXQsXG4gICAgY3VzdG9tUG9zOiBjdXN0b21Qb3NcbiAgfTtcbn07XG4vKipcbiAqIEdldCB0aGUgb2Zmc2V0IG9mIGFuIGVsZW1lbnRcbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsZW1lbnQgVGhlIERPTSBlbGVtZW50XG4gKiBAcGFyYW0ge29iamVjdH0gY3R4IFRoZSBjb250ZXh0XG4gKlxuICogQHJldHVybiB7b2JqZWN0fSB0b3AgYW5kIGxlZnRcbiAqL1xuXG52YXIgZ2V0T2Zmc2V0ID0gZnVuY3Rpb24gZ2V0T2Zmc2V0KGVsZW1lbnQsIGN0eCkge1xuICB2YXIgd2luID0gY3R4ICYmIGN0eC53aW5kb3cgfHwgd2luZG93O1xuICB2YXIgZG9jID0gY3R4ICYmIGN0eC5kb2N1bWVudCB8fCBkb2N1bWVudDtcbiAgdmFyIHJlY3QgPSBlbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICB2YXIgZG9jRWwgPSBkb2MuZG9jdW1lbnRFbGVtZW50O1xuICB2YXIgc2Nyb2xsTGVmdCA9IHdpbi5wYWdlWE9mZnNldCB8fCBkb2NFbC5zY3JvbGxMZWZ0O1xuICB2YXIgc2Nyb2xsVG9wID0gd2luLnBhZ2VZT2Zmc2V0IHx8IGRvY0VsLnNjcm9sbFRvcDtcbiAgcmV0dXJuIHtcbiAgICB0b3A6IHJlY3QudG9wICsgc2Nyb2xsVG9wLFxuICAgIGxlZnQ6IHJlY3QubGVmdCArIHNjcm9sbExlZnRcbiAgfTtcbn07XG4vKipcbiAqIENoZWNrIGlmIGEgdmFsdWUgaXMgYW4gb2JqZWN0XG4gKlxuICogQHBhcmFtIHthbnl9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVja1xuICpcbiAqIEByZXR1cm4ge2Jvb2x9IElmIGl0IGlzIGFuIG9iamVjdFxuICovXG5cbnZhciBpc09iamVjdCA9IGZ1bmN0aW9uIGlzT2JqZWN0KHZhbHVlKSB7XG4gIHJldHVybiBfdHlwZW9mKHZhbHVlKSA9PT0gJ29iamVjdCcgJiYgdmFsdWUgIT09IG51bGw7XG59O1xuXG4vKipcbiAqIENyZWF0ZSBhIElucHV0IGNhcmV0IG9iamVjdC5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsZW1lbnQgVGhlIGVsZW1lbnRcbiAqIEBwYXJhbSB7T2JqZWN0fSBjdHggVGhlIGNvbnRleHRcbiAqL1xuXG52YXIgY3JlYXRlSW5wdXRDYXJldCA9IGZ1bmN0aW9uIGNyZWF0ZUlucHV0Q2FyZXQoZWxlbWVudCwgY3R4KSB7XG4gIC8qKlxuICAgKiBHZXQgdGhlIGN1cnJlbnQgcG9zaXRpb25cbiAgICpcbiAgICogQHJldHVybnMge2ludH0gVGhlIGNhcmV0IHBvc2l0aW9uXG4gICAqL1xuICB2YXIgZ2V0UG9zID0gZnVuY3Rpb24gZ2V0UG9zKCkge1xuICAgIHJldHVybiBlbGVtZW50LnNlbGVjdGlvblN0YXJ0O1xuICB9O1xuICAvKipcbiAgICogU2V0IHRoZSBwb3NpdGlvblxuICAgKlxuICAgKiBAcGFyYW0ge2ludH0gcG9zIFRoZSBwb3NpdGlvblxuICAgKlxuICAgKiBAcmV0dXJuIHtFbGVtZW50fSBUaGUgZWxlbWVudFxuICAgKi9cblxuXG4gIHZhciBzZXRQb3MgPSBmdW5jdGlvbiBzZXRQb3MocG9zKSB7XG4gICAgZWxlbWVudC5zZXRTZWxlY3Rpb25SYW5nZShwb3MsIHBvcyk7XG4gICAgcmV0dXJuIGVsZW1lbnQ7XG4gIH07XG4gIC8qKlxuICAgKiBUaGUgb2Zmc2V0XG4gICAqXG4gICAqIEBwYXJhbSB7aW50fSBwb3MgVGhlIHBvc2l0aW9uXG4gICAqXG4gICAqIEByZXR1cm4ge29iamVjdH0gVGhlIG9mZnNldFxuICAgKi9cblxuXG4gIHZhciBnZXRPZmZzZXQkMSA9IGZ1bmN0aW9uIGdldE9mZnNldCQxKHBvcykge1xuICAgIHZhciByZWN0ID0gZ2V0T2Zmc2V0KGVsZW1lbnQpO1xuICAgIHZhciBwb3NpdGlvbiA9IGdldFBvc2l0aW9uKHBvcyk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHRvcDogcmVjdC50b3AgKyBwb3NpdGlvbi50b3AgKyBjdHguZG9jdW1lbnQuYm9keS5zY3JvbGxUb3AsXG4gICAgICBsZWZ0OiByZWN0LmxlZnQgKyBwb3NpdGlvbi5sZWZ0ICsgY3R4LmRvY3VtZW50LmJvZHkuc2Nyb2xsTGVmdCxcbiAgICAgIGhlaWdodDogcG9zaXRpb24uaGVpZ2h0XG4gICAgfTtcbiAgfTtcbiAgLyoqXG4gICAqIEdldCB0aGUgY3VycmVudCBwb3NpdGlvblxuICAgKlxuICAgKiBAcGFyYW0ge2ludH0gcG9zIFRoZSBwb3NpdGlvblxuICAgKlxuICAgKiBAcmV0dXJuIHtvYmplY3R9IFRoZSBwb3NpdGlvblxuICAgKi9cblxuXG4gIHZhciBnZXRQb3NpdGlvbiA9IGZ1bmN0aW9uIGdldFBvc2l0aW9uKHBvcykge1xuICAgIHZhciBmb3JtYXQgPSBmdW5jdGlvbiBmb3JtYXQodmFsKSB7XG4gICAgICB2YXIgdmFsdWUgPSB2YWwucmVwbGFjZSgvPHw+fGB8XCJ8Ji9nLCAnPycpLnJlcGxhY2UoL1xcclxcbnxcXHJ8XFxuL2csICc8YnIvPicpO1xuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH07XG5cbiAgICBpZiAoY3R4LmN1c3RvbVBvcyB8fCBjdHguY3VzdG9tUG9zID09PSAwKSB7XG4gICAgICBwb3MgPSBjdHguY3VzdG9tUG9zO1xuICAgIH1cblxuICAgIHZhciBwb3NpdGlvbiA9IHBvcyA9PT0gdW5kZWZpbmVkID8gZ2V0UG9zKCkgOiBwb3M7XG4gICAgdmFyIHN0YXJ0UmFuZ2UgPSBlbGVtZW50LnZhbHVlLnNsaWNlKDAsIHBvc2l0aW9uKTtcbiAgICB2YXIgZW5kUmFuZ2UgPSBlbGVtZW50LnZhbHVlLnNsaWNlKHBvc2l0aW9uKTtcbiAgICB2YXIgaHRtbCA9IFwiPHNwYW4gc3R5bGU9XFxcInBvc2l0aW9uOiByZWxhdGl2ZTsgZGlzcGxheTogaW5saW5lO1xcXCI+XCIuY29uY2F0KGZvcm1hdChzdGFydFJhbmdlKSwgXCI8L3NwYW4+XCIpO1xuICAgIGh0bWwgKz0gJzxzcGFuIGlkPVwiY2FyZXQtcG9zaXRpb24tbWFya2VyXCIgc3R5bGU9XCJwb3NpdGlvbjogcmVsYXRpdmU7IGRpc3BsYXk6IGlubGluZTtcIj58PC9zcGFuPic7XG4gICAgaHRtbCArPSBcIjxzcGFuIHN0eWxlPVxcXCJwb3NpdGlvbjogcmVsYXRpdmU7IGRpc3BsYXk6IGlubGluZTtcXFwiPlwiLmNvbmNhdChmb3JtYXQoZW5kUmFuZ2UpLCBcIjwvc3Bhbj5cIik7XG4gICAgdmFyIG1pcnJvciA9IGNyZWF0ZU1pcnJvcihlbGVtZW50LCBodG1sKTtcbiAgICB2YXIgcmVjdCA9IG1pcnJvci5yZWN0KCk7XG4gICAgcmVjdC5wb3MgPSBnZXRQb3MoKTtcbiAgICByZXR1cm4gcmVjdDtcbiAgfTtcblxuICByZXR1cm4ge1xuICAgIGdldFBvczogZ2V0UG9zLFxuICAgIHNldFBvczogc2V0UG9zLFxuICAgIGdldE9mZnNldDogZ2V0T2Zmc2V0JDEsXG4gICAgZ2V0UG9zaXRpb246IGdldFBvc2l0aW9uXG4gIH07XG59O1xuXG4vKipcbiAqIENyZWF0ZSBhbiBFZGl0YWJsZSBDYXJldFxuICogQHBhcmFtIHtFbGVtZW50fSBlbGVtZW50IFRoZSBlZGl0YWJsZSBlbGVtZW50XG4gKiBAcGFyYW0ge29iamVjdHxudWxsfSBjdHggVGhlIGNvbnRleHRcbiAqXG4gKiBAcmV0dXJuIHtFZGl0YWJsZUNhcmV0fVxuICovXG52YXIgY3JlYXRlRWRpdGFibGVDYXJldCA9IGZ1bmN0aW9uIGNyZWF0ZUVkaXRhYmxlQ2FyZXQoZWxlbWVudCwgY3R4KSB7XG4gIC8qKlxuICAgKiBTZXQgdGhlIGNhcmV0IHBvc2l0aW9uXG4gICAqXG4gICAqIEBwYXJhbSB7aW50fSBwb3MgVGhlIHBvc2l0aW9uIHRvIHNlXG4gICAqXG4gICAqIEByZXR1cm4ge0VsZW1lbnR9IFRoZSBlbGVtZW50XG4gICAqL1xuICB2YXIgc2V0UG9zID0gZnVuY3Rpb24gc2V0UG9zKHBvcykge1xuICAgIHZhciBzZWwgPSBjdHgud2luZG93LmdldFNlbGVjdGlvbigpO1xuXG4gICAgaWYgKHNlbCkge1xuICAgICAgdmFyIG9mZnNldCA9IDA7XG4gICAgICB2YXIgZm91bmQgPSBmYWxzZTtcblxuICAgICAgdmFyIGZpbmQgPSBmdW5jdGlvbiBmaW5kKHBvc2l0aW9uLCBwYXJlbnQpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwYXJlbnQuY2hpbGROb2Rlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIHZhciBub2RlID0gcGFyZW50LmNoaWxkTm9kZXNbaV07XG5cbiAgICAgICAgICBpZiAoZm91bmQpIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChub2RlLm5vZGVUeXBlID09PSAzKSB7XG4gICAgICAgICAgICBpZiAob2Zmc2V0ICsgbm9kZS5sZW5ndGggPj0gcG9zaXRpb24pIHtcbiAgICAgICAgICAgICAgZm91bmQgPSB0cnVlO1xuICAgICAgICAgICAgICB2YXIgcmFuZ2UgPSBjdHguZG9jdW1lbnQuY3JlYXRlUmFuZ2UoKTtcbiAgICAgICAgICAgICAgcmFuZ2Uuc2V0U3RhcnQobm9kZSwgcG9zaXRpb24gLSBvZmZzZXQpO1xuICAgICAgICAgICAgICBzZWwucmVtb3ZlQWxsUmFuZ2VzKCk7XG4gICAgICAgICAgICAgIHNlbC5hZGRSYW5nZShyYW5nZSk7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgb2Zmc2V0ICs9IG5vZGUubGVuZ3RoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmaW5kKHBvcywgbm9kZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICBmaW5kKHBvcywgZWxlbWVudCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGVsZW1lbnQ7XG4gIH07XG4gIC8qKlxuICAgKiBHZXQgdGhlIG9mZnNldFxuICAgKlxuICAgKiBAcmV0dXJuIHtvYmplY3R9IFRoZSBvZmZzZXRcbiAgICovXG5cblxuICB2YXIgZ2V0T2Zmc2V0ID0gZnVuY3Rpb24gZ2V0T2Zmc2V0KCkge1xuICAgIHZhciByYW5nZSA9IGdldFJhbmdlKCk7XG4gICAgdmFyIG9mZnNldCA9IHtcbiAgICAgIGhlaWdodDogMCxcbiAgICAgIGxlZnQ6IDAsXG4gICAgICByaWdodDogMFxuICAgIH07XG5cbiAgICBpZiAoIXJhbmdlKSB7XG4gICAgICByZXR1cm4gb2Zmc2V0O1xuICAgIH1cblxuICAgIHZhciBoYXNDdXN0b21Qb3MgPSBjdHguY3VzdG9tUG9zIHx8IGN0eC5jdXN0b21Qb3MgPT09IDA7IC8vIGVuZENvbnRhaW5lciBpbiBGaXJlZm94IHdvdWxkIGJlIHRoZSBlbGVtZW50IGF0IHRoZSBzdGFydCBvZlxuICAgIC8vIHRoZSBsaW5lXG5cbiAgICBpZiAocmFuZ2UuZW5kT2Zmc2V0IC0gMSA+IDAgJiYgcmFuZ2UuZW5kQ29udGFpbmVyICE9PSBlbGVtZW50IHx8IGhhc0N1c3RvbVBvcykge1xuICAgICAgdmFyIGNsb25lZFJhbmdlID0gcmFuZ2UuY2xvbmVSYW5nZSgpO1xuICAgICAgdmFyIGZpeGVkUG9zaXRpb24gPSBoYXNDdXN0b21Qb3MgPyBjdHguY3VzdG9tUG9zIDogcmFuZ2UuZW5kT2Zmc2V0O1xuICAgICAgY2xvbmVkUmFuZ2Uuc2V0U3RhcnQocmFuZ2UuZW5kQ29udGFpbmVyLCBmaXhlZFBvc2l0aW9uIC0gMSA8IDAgPyAwIDogZml4ZWRQb3NpdGlvbiAtIDEpO1xuICAgICAgY2xvbmVkUmFuZ2Uuc2V0RW5kKHJhbmdlLmVuZENvbnRhaW5lciwgZml4ZWRQb3NpdGlvbik7XG4gICAgICB2YXIgcmVjdCA9IGNsb25lZFJhbmdlLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgb2Zmc2V0ID0ge1xuICAgICAgICBoZWlnaHQ6IHJlY3QuaGVpZ2h0LFxuICAgICAgICBsZWZ0OiByZWN0LmxlZnQgKyByZWN0LndpZHRoLFxuICAgICAgICB0b3A6IHJlY3QudG9wXG4gICAgICB9O1xuICAgICAgY2xvbmVkUmFuZ2UuZGV0YWNoKCk7XG4gICAgfVxuXG4gICAgaWYgKCghb2Zmc2V0IHx8IG9mZnNldCAmJiBvZmZzZXQuaGVpZ2h0ID09PSAwKSAmJiAhY3R4Lm5vU2hhZG93Q2FyZXQpIHtcbiAgICAgIHZhciBfY2xvbmVkUmFuZ2UgPSByYW5nZS5jbG9uZVJhbmdlKCk7XG5cbiAgICAgIHZhciBzaGFkb3dDYXJldCA9IGN0eC5kb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnfCcpO1xuXG4gICAgICBfY2xvbmVkUmFuZ2UuaW5zZXJ0Tm9kZShzaGFkb3dDYXJldCk7XG5cbiAgICAgIF9jbG9uZWRSYW5nZS5zZWxlY3ROb2RlKHNoYWRvd0NhcmV0KTtcblxuICAgICAgdmFyIF9yZWN0ID0gX2Nsb25lZFJhbmdlLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXG4gICAgICBvZmZzZXQgPSB7XG4gICAgICAgIGhlaWdodDogX3JlY3QuaGVpZ2h0LFxuICAgICAgICBsZWZ0OiBfcmVjdC5sZWZ0LFxuICAgICAgICB0b3A6IF9yZWN0LnRvcFxuICAgICAgfTtcbiAgICAgIHNoYWRvd0NhcmV0LnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoc2hhZG93Q2FyZXQpO1xuXG4gICAgICBfY2xvbmVkUmFuZ2UuZGV0YWNoKCk7XG4gICAgfVxuXG4gICAgaWYgKG9mZnNldCkge1xuICAgICAgdmFyIGRvYyA9IGN0eC5kb2N1bWVudC5kb2N1bWVudEVsZW1lbnQ7XG4gICAgICBvZmZzZXQudG9wICs9IGN0eC53aW5kb3cucGFnZVlPZmZzZXQgLSAoZG9jLmNsaWVudFRvcCB8fCAwKTtcbiAgICAgIG9mZnNldC5sZWZ0ICs9IGN0eC53aW5kb3cucGFnZVhPZmZzZXQgLSAoZG9jLmNsaWVudExlZnQgfHwgMCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG9mZnNldDtcbiAgfTtcbiAgLyoqXG4gICAqIEdldCB0aGUgcG9zaXRpb25cbiAgICpcbiAgICogQHJldHVybiB7b2JqZWN0fSBUaGUgcG9zaXRpb25cbiAgICovXG5cblxuICB2YXIgZ2V0UG9zaXRpb24gPSBmdW5jdGlvbiBnZXRQb3NpdGlvbigpIHtcbiAgICB2YXIgb2Zmc2V0ID0gZ2V0T2Zmc2V0KCk7XG4gICAgdmFyIHBvcyA9IGdldFBvcygpO1xuICAgIHZhciByZWN0ID0gZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICB2YXIgaW5wdXRPZmZzZXQgPSB7XG4gICAgICB0b3A6IHJlY3QudG9wICsgY3R4LmRvY3VtZW50LmJvZHkuc2Nyb2xsVG9wLFxuICAgICAgbGVmdDogcmVjdC5sZWZ0ICsgY3R4LmRvY3VtZW50LmJvZHkuc2Nyb2xsTGVmdFxuICAgIH07XG4gICAgb2Zmc2V0LmxlZnQgLT0gaW5wdXRPZmZzZXQubGVmdDtcbiAgICBvZmZzZXQudG9wIC09IGlucHV0T2Zmc2V0LnRvcDtcbiAgICBvZmZzZXQucG9zID0gcG9zO1xuICAgIHJldHVybiBvZmZzZXQ7XG4gIH07XG4gIC8qKlxuICAgKiBHZXQgdGhlIHJhbmdlXG4gICAqXG4gICAqIEByZXR1cm4ge1JhbmdlfG51bGx9XG4gICAqL1xuXG5cbiAgdmFyIGdldFJhbmdlID0gZnVuY3Rpb24gZ2V0UmFuZ2UoKSB7XG4gICAgaWYgKCFjdHgud2luZG93LmdldFNlbGVjdGlvbikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBzZWwgPSBjdHgud2luZG93LmdldFNlbGVjdGlvbigpO1xuICAgIHJldHVybiBzZWwucmFuZ2VDb3VudCA+IDAgPyBzZWwuZ2V0UmFuZ2VBdCgwKSA6IG51bGw7XG4gIH07XG4gIC8qKlxuICAgKiBHZXQgdGhlIGNhcmV0IHBvc2l0aW9uXG4gICAqXG4gICAqIEByZXR1cm4ge2ludH0gVGhlIHBvc2l0aW9uXG4gICAqL1xuXG5cbiAgdmFyIGdldFBvcyA9IGZ1bmN0aW9uIGdldFBvcygpIHtcbiAgICB2YXIgcmFuZ2UgPSBnZXRSYW5nZSgpO1xuICAgIHZhciBjbG9uZWRSYW5nZSA9IHJhbmdlLmNsb25lUmFuZ2UoKTtcbiAgICBjbG9uZWRSYW5nZS5zZWxlY3ROb2RlQ29udGVudHMoZWxlbWVudCk7XG4gICAgY2xvbmVkUmFuZ2Uuc2V0RW5kKHJhbmdlLmVuZENvbnRhaW5lciwgcmFuZ2UuZW5kT2Zmc2V0KTtcbiAgICB2YXIgcG9zID0gY2xvbmVkUmFuZ2UudG9TdHJpbmcoKS5sZW5ndGg7XG4gICAgY2xvbmVkUmFuZ2UuZGV0YWNoKCk7XG4gICAgcmV0dXJuIHBvcztcbiAgfTtcblxuICByZXR1cm4ge1xuICAgIGdldFBvczogZ2V0UG9zLFxuICAgIHNldFBvczogc2V0UG9zLFxuICAgIGdldFBvc2l0aW9uOiBnZXRQb3NpdGlvbixcbiAgICBnZXRPZmZzZXQ6IGdldE9mZnNldCxcbiAgICBnZXRSYW5nZTogZ2V0UmFuZ2VcbiAgfTtcbn07XG5cbnZhciBjcmVhdGVDYXJldCA9IGZ1bmN0aW9uIGNyZWF0ZUNhcmV0KGVsZW1lbnQsIGN0eCkge1xuICBpZiAoaXNDb250ZW50RWRpdGFibGUoZWxlbWVudCkpIHtcbiAgICByZXR1cm4gY3JlYXRlRWRpdGFibGVDYXJldChlbGVtZW50LCBjdHgpO1xuICB9XG5cbiAgcmV0dXJuIGNyZWF0ZUlucHV0Q2FyZXQoZWxlbWVudCwgY3R4KTtcbn07XG5cbnZhciBwb3NpdGlvbiA9IGZ1bmN0aW9uIHBvc2l0aW9uKGVsZW1lbnQsIHZhbHVlKSB7XG4gIHZhciBzZXR0aW5ncyA9IGFyZ3VtZW50cy5sZW5ndGggPiAyICYmIGFyZ3VtZW50c1syXSAhPT0gdW5kZWZpbmVkID8gYXJndW1lbnRzWzJdIDoge307XG4gIHZhciBvcHRpb25zID0gc2V0dGluZ3M7XG5cbiAgaWYgKGlzT2JqZWN0KHZhbHVlKSkge1xuICAgIG9wdGlvbnMgPSB2YWx1ZTtcbiAgICB2YWx1ZSA9IG51bGw7XG4gIH1cblxuICB2YXIgY3R4ID0gZ2V0Q29udGV4dChvcHRpb25zKTtcbiAgdmFyIGNhcmV0ID0gY3JlYXRlQ2FyZXQoZWxlbWVudCwgY3R4KTtcblxuICBpZiAodmFsdWUgfHwgdmFsdWUgPT09IDApIHtcbiAgICByZXR1cm4gY2FyZXQuc2V0UG9zKHZhbHVlKTtcbiAgfVxuXG4gIHJldHVybiBjYXJldC5nZXRQb3NpdGlvbigpO1xufTtcbi8qKlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxlbWVudCBUaGUgRE9NIGVsZW1lbnRcbiAqIEBwYXJhbSB7bnVtYmVyfHVuZGVmaW5lZH0gdmFsdWUgVGhlIHZhbHVlIHRvIHNldFxuICogQHBhcmFtIHtvYmplY3R9IHNldHRpbmdzIEFueSBzZXR0aW5ncyBmb3IgY29udGV4dFxuICovXG5cbnZhciBvZmZzZXQgPSBmdW5jdGlvbiBvZmZzZXQoZWxlbWVudCwgdmFsdWUpIHtcbiAgdmFyIHNldHRpbmdzID0gYXJndW1lbnRzLmxlbmd0aCA+IDIgJiYgYXJndW1lbnRzWzJdICE9PSB1bmRlZmluZWQgPyBhcmd1bWVudHNbMl0gOiB7fTtcbiAgdmFyIG9wdGlvbnMgPSBzZXR0aW5ncztcblxuICBpZiAoaXNPYmplY3QodmFsdWUpKSB7XG4gICAgb3B0aW9ucyA9IHZhbHVlO1xuICAgIHZhbHVlID0gbnVsbDtcbiAgfVxuXG4gIHZhciBjdHggPSBnZXRDb250ZXh0KG9wdGlvbnMpO1xuICB2YXIgY2FyZXQgPSBjcmVhdGVDYXJldChlbGVtZW50LCBjdHgpO1xuICByZXR1cm4gY2FyZXQuZ2V0T2Zmc2V0KHZhbHVlKTtcbn07XG5cbmV4cG9ydCB7IGdldE9mZnNldCwgb2Zmc2V0LCBwb3NpdGlvbiB9O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9bWFpbi5qcy5tYXBcbiIsImltcG9ydCAqIGFzIGNhcmV0UG9zIGZyb20gJ2NhcmV0LXBvcyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBzY3JvbGxUZXh0QXJlYURvd25Ub0NhcmV0SWZOZWVkZWQodGV4dEFyZWE6IEhUTUxUZXh0QXJlYUVsZW1lbnQpIHtcbiAgICAvLyBOb3RlIHRoYXQgdGhpcyBvbmx5IHNjcm9sbHMgKmRvd24qLCBiZWNhdXNlIHRoYXQncyB0aGUgb25seSBzY2VuYXJpbyBhZnRlciBhIHN1Z2dlc3Rpb24gaXMgYWNjZXB0ZWRcbiAgICBjb25zdCBwb3MgPSBjYXJldFBvcy5wb3NpdGlvbih0ZXh0QXJlYSk7XG4gICAgY29uc3QgbGluZUhlaWdodEluUGl4ZWxzID0gcGFyc2VGbG9hdCh3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSh0ZXh0QXJlYSkubGluZUhlaWdodCk7XG4gICAgaWYgKHBvcy50b3AgPiB0ZXh0QXJlYS5jbGllbnRIZWlnaHQgKyB0ZXh0QXJlYS5zY3JvbGxUb3AgLSBsaW5lSGVpZ2h0SW5QaXhlbHMpIHtcbiAgICAgICAgdGV4dEFyZWEuc2Nyb2xsVG9wID0gcG9zLnRvcCAtIHRleHRBcmVhLmNsaWVudEhlaWdodCArIGxpbmVIZWlnaHRJblBpeGVscztcbiAgICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDYXJldE9mZnNldEZyb21PZmZzZXRQYXJlbnQoZWxlbTogSFRNTFRleHRBcmVhRWxlbWVudCk6IHsgdG9wOiBudW1iZXIsIGxlZnQ6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIsIGVsZW1TdHlsZTogQ1NTU3R5bGVEZWNsYXJhdGlvbiB9IHtcbiAgICBjb25zdCBlbGVtU3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShlbGVtKTtcbiAgICBjb25zdCBwb3MgPSBjYXJldFBvcy5wb3NpdGlvbihlbGVtKTtcblxuICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogcG9zLnRvcCArIHBhcnNlRmxvYXQoZWxlbVN0eWxlLmJvcmRlclRvcFdpZHRoKSArIGVsZW0ub2Zmc2V0VG9wIC0gZWxlbS5zY3JvbGxUb3AsXG4gICAgICAgIGxlZnQ6IHBvcy5sZWZ0ICsgcGFyc2VGbG9hdChlbGVtU3R5bGUuYm9yZGVyTGVmdFdpZHRoKSArIGVsZW0ub2Zmc2V0TGVmdCAtIGVsZW0uc2Nyb2xsTGVmdCAtIDAuMjUsXG4gICAgICAgIGhlaWdodDogcG9zLmhlaWdodCxcbiAgICAgICAgZWxlbVN0eWxlOiBlbGVtU3R5bGUsXG4gICAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gaW5zZXJ0VGV4dEF0Q2FyZXRQb3NpdGlvbih0ZXh0QXJlYTogSFRNTFRleHRBcmVhRWxlbWVudCwgdGV4dDogc3RyaW5nKSB7XG4gICAgLy8gRXZlbiB0aG91Z2ggZG9jdW1lbnQuZXhlY0NvbW1hbmQgaXMgZGVwcmVjYXRlZCwgaXQncyBzdGlsbCB0aGUgYmVzdCB3YXkgdG8gaW5zZXJ0IHRleHQsIGJlY2F1c2UgaXQnc1xuICAgIC8vIHRoZSBvbmx5IHdheSB0aGF0IGludGVyYWN0cyBjb3JyZWN0bHkgd2l0aCB0aGUgdW5kbyBidWZmZXIuIElmIHdlIGhhdmUgdG8gZmFsbCBiYWNrIG9uIG11dGF0aW5nXG4gICAgLy8gdGhlIC52YWx1ZSBwcm9wZXJ0eSBkaXJlY3RseSwgaXQgd29ya3MgYnV0IGVyYXNlcyB0aGUgdW5kbyBidWZmZXIuXG4gICAgaWYgKGRvY3VtZW50LmV4ZWNDb21tYW5kKSB7XG4gICAgICAgIGRvY3VtZW50LmV4ZWNDb21tYW5kKCdpbnNlcnRUZXh0JywgZmFsc2UsIHRleHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGxldCBjYXJldFBvcyA9IHRleHRBcmVhLnNlbGVjdGlvblN0YXJ0O1xuICAgICAgICB0ZXh0QXJlYS52YWx1ZSA9IHRleHRBcmVhLnZhbHVlLnN1YnN0cmluZygwLCBjYXJldFBvcylcbiAgICAgICAgICAgICsgdGV4dFxuICAgICAgICAgICAgKyB0ZXh0QXJlYS52YWx1ZS5zdWJzdHJpbmcodGV4dEFyZWEuc2VsZWN0aW9uRW5kKTtcbiAgICAgICAgY2FyZXRQb3MgKz0gdGV4dC5sZW5ndGg7XG4gICAgICAgIHRleHRBcmVhLnNldFNlbGVjdGlvblJhbmdlKGNhcmV0UG9zLCBjYXJldFBvcyk7XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgU3VnZ2VzdGlvbkRpc3BsYXkgfSBmcm9tICcuL1N1Z2dlc3Rpb25EaXNwbGF5JztcbmltcG9ydCB7IFNtYXJ0VGV4dEFyZWEgfSBmcm9tICcuL1NtYXJ0VGV4dEFyZWEnO1xuaW1wb3J0IHsgZ2V0Q2FyZXRPZmZzZXRGcm9tT2Zmc2V0UGFyZW50LCBzY3JvbGxUZXh0QXJlYURvd25Ub0NhcmV0SWZOZWVkZWQgfSBmcm9tICcuL0NhcmV0VXRpbCc7XG5cbmV4cG9ydCBjbGFzcyBJbmxpbmVTdWdnZXN0aW9uRGlzcGxheSBpbXBsZW1lbnRzIFN1Z2dlc3Rpb25EaXNwbGF5IHtcbiAgICBsYXRlc3RTdWdnZXN0aW9uVGV4dDogc3RyaW5nID0gJyc7XG4gICAgc3VnZ2VzdGlvblN0YXJ0UG9zOiBudW1iZXIgfCBudWxsID0gbnVsbDtcbiAgICBzdWdnZXN0aW9uRW5kUG9zOiBudW1iZXIgfCBudWxsID0gbnVsbDtcbiAgICBmYWtlQ2FyZXQ6IEZha2VDYXJldCB8IG51bGwgPSBudWxsO1xuICAgIG9yaWdpbmFsVmFsdWVQcm9wZXJ0eTogUHJvcGVydHlEZXNjcmlwdG9yO1xuXG4gICAgY29uc3RydWN0b3IocHJpdmF0ZSBvd25lcjogU21hcnRUZXh0QXJlYSwgcHJpdmF0ZSB0ZXh0QXJlYTogSFRNTFRleHRBcmVhRWxlbWVudCkge1xuICAgICAgICAvLyBXaGVuIGFueSBvdGhlciBKUyBjb2RlIGFza3MgZm9yIHRoZSB2YWx1ZSBvZiB0aGUgdGV4dGFyZWEsIHdlIHdhbnQgdG8gcmV0dXJuIHRoZSB2YWx1ZVxuICAgICAgICAvLyB3aXRob3V0IGFueSBwZW5kaW5nIHN1Z2dlc3Rpb24sIG90aGVyd2lzZSBpdCB3aWxsIGJyZWFrIHRoaW5ncyBsaWtlIGJpbmRpbmdzXG4gICAgICAgIHRoaXMub3JpZ2luYWxWYWx1ZVByb3BlcnR5ID0gZmluZFByb3BlcnR5UmVjdXJzaXZlKHRleHRBcmVhLCAndmFsdWUnKTtcbiAgICAgICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0ZXh0QXJlYSwgJ3ZhbHVlJywge1xuICAgICAgICAgICAgZ2V0KCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRydWVWYWx1ZSA9IHNlbGYub3JpZ2luYWxWYWx1ZVByb3BlcnR5LmdldC5jYWxsKHRleHRBcmVhKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gc2VsZi5pc1Nob3dpbmcoKVxuICAgICAgICAgICAgICAgICAgICA/IHRydWVWYWx1ZS5zdWJzdHJpbmcoMCwgc2VsZi5zdWdnZXN0aW9uU3RhcnRQb3MpICsgdHJ1ZVZhbHVlLnN1YnN0cmluZyhzZWxmLnN1Z2dlc3Rpb25FbmRQb3MpXG4gICAgICAgICAgICAgICAgICAgIDogdHJ1ZVZhbHVlO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNldCh2KSB7XG4gICAgICAgICAgICAgICAgc2VsZi5vcmlnaW5hbFZhbHVlUHJvcGVydHkuc2V0LmNhbGwodGV4dEFyZWEsIHYpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBnZXQgdmFsdWVJbmNsdWRpbmdTdWdnZXN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5vcmlnaW5hbFZhbHVlUHJvcGVydHkuZ2V0LmNhbGwodGhpcy50ZXh0QXJlYSk7XG4gICAgfVxuXG4gICAgc2V0IHZhbHVlSW5jbHVkaW5nU3VnZ2VzdGlvbih2YWw6IHN0cmluZykge1xuICAgICAgICB0aGlzLm9yaWdpbmFsVmFsdWVQcm9wZXJ0eS5zZXQuY2FsbCh0aGlzLnRleHRBcmVhLCB2YWwpO1xuICAgIH1cblxuICAgIGlzU2hvd2luZygpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3VnZ2VzdGlvblN0YXJ0UG9zICE9PSBudWxsO1xuICAgIH1cblxuICAgIHNob3coc3VnZ2VzdGlvbjogc3RyaW5nKTogdm9pZCB7XG4gICAgICAgIHRoaXMubGF0ZXN0U3VnZ2VzdGlvblRleHQgPSBzdWdnZXN0aW9uO1xuICAgICAgICB0aGlzLnN1Z2dlc3Rpb25TdGFydFBvcyA9IHRoaXMudGV4dEFyZWEuc2VsZWN0aW9uU3RhcnQ7XG4gICAgICAgIHRoaXMuc3VnZ2VzdGlvbkVuZFBvcyA9IHRoaXMuc3VnZ2VzdGlvblN0YXJ0UG9zICsgc3VnZ2VzdGlvbi5sZW5ndGg7XG5cbiAgICAgICAgdGhpcy50ZXh0QXJlYS5zZXRBdHRyaWJ1dGUoJ2RhdGEtc3VnZ2VzdGlvbi12aXNpYmxlJywgJycpO1xuICAgICAgICB0aGlzLnZhbHVlSW5jbHVkaW5nU3VnZ2VzdGlvbiA9IHRoaXMudmFsdWVJbmNsdWRpbmdTdWdnZXN0aW9uLnN1YnN0cmluZygwLCB0aGlzLnN1Z2dlc3Rpb25TdGFydFBvcykgKyBzdWdnZXN0aW9uICsgdGhpcy52YWx1ZUluY2x1ZGluZ1N1Z2dlc3Rpb24uc3Vic3RyaW5nKHRoaXMuc3VnZ2VzdGlvblN0YXJ0UG9zKTtcbiAgICAgICAgdGhpcy50ZXh0QXJlYS5zZXRTZWxlY3Rpb25SYW5nZSh0aGlzLnN1Z2dlc3Rpb25TdGFydFBvcywgdGhpcy5zdWdnZXN0aW9uRW5kUG9zKTtcblxuICAgICAgICB0aGlzLmZha2VDYXJldCA/Pz0gbmV3IEZha2VDYXJldCh0aGlzLm93bmVyLCB0aGlzLnRleHRBcmVhKTtcbiAgICAgICAgdGhpcy5mYWtlQ2FyZXQuc2hvdygpO1xuICAgIH1cblxuICAgIGdldCBjdXJyZW50U3VnZ2VzdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubGF0ZXN0U3VnZ2VzdGlvblRleHQ7XG4gICAgfVxuXG4gICAgYWNjZXB0KCk6IHZvaWQge1xuICAgICAgICB0aGlzLnRleHRBcmVhLnNldFNlbGVjdGlvblJhbmdlKHRoaXMuc3VnZ2VzdGlvbkVuZFBvcywgdGhpcy5zdWdnZXN0aW9uRW5kUG9zKTtcbiAgICAgICAgdGhpcy5zdWdnZXN0aW9uU3RhcnRQb3MgPSBudWxsO1xuICAgICAgICB0aGlzLnN1Z2dlc3Rpb25FbmRQb3MgPSBudWxsO1xuICAgICAgICB0aGlzLmZha2VDYXJldD8uaGlkZSgpO1xuICAgICAgICB0aGlzLnRleHRBcmVhLnJlbW92ZUF0dHJpYnV0ZSgnZGF0YS1zdWdnZXN0aW9uLXZpc2libGUnKTtcblxuICAgICAgICAvLyBUaGUgbmV3bHktaW5zZXJ0ZWQgdGV4dCBjb3VsZCBiZSBzbyBsb25nIHRoYXQgdGhlIG5ldyBjYXJldCBwb3NpdGlvbiBpcyBvZmYgdGhlIGJvdHRvbSBvZiB0aGUgdGV4dGFyZWEuXG4gICAgICAgIC8vIEl0IHdvbid0IHNjcm9sbCB0byB0aGUgbmV3IGNhcmV0IHBvc2l0aW9uIGJ5IGRlZmF1bHRcbiAgICAgICAgc2Nyb2xsVGV4dEFyZWFEb3duVG9DYXJldElmTmVlZGVkKHRoaXMudGV4dEFyZWEpO1xuICAgIH1cblxuICAgIHJlamVjdCgpOiB2b2lkIHtcbiAgICAgICAgaWYgKCF0aGlzLmlzU2hvd2luZygpKSB7XG4gICAgICAgICAgICByZXR1cm47IC8vIE5vIHN1Z2dlc3Rpb24gaXMgc2hvd25cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHByZXZTZWxlY3Rpb25TdGFydCA9IHRoaXMudGV4dEFyZWEuc2VsZWN0aW9uU3RhcnQ7XG4gICAgICAgIGNvbnN0IHByZXZTZWxlY3Rpb25FbmQgPSB0aGlzLnRleHRBcmVhLnNlbGVjdGlvbkVuZDtcbiAgICAgICAgdGhpcy52YWx1ZUluY2x1ZGluZ1N1Z2dlc3Rpb24gPSB0aGlzLnZhbHVlSW5jbHVkaW5nU3VnZ2VzdGlvbi5zdWJzdHJpbmcoMCwgdGhpcy5zdWdnZXN0aW9uU3RhcnRQb3MpICsgdGhpcy52YWx1ZUluY2x1ZGluZ1N1Z2dlc3Rpb24uc3Vic3RyaW5nKHRoaXMuc3VnZ2VzdGlvbkVuZFBvcyk7XG5cbiAgICAgICAgaWYgKHRoaXMuc3VnZ2VzdGlvblN0YXJ0UG9zID09PSBwcmV2U2VsZWN0aW9uU3RhcnQgJiYgdGhpcy5zdWdnZXN0aW9uRW5kUG9zID09PSBwcmV2U2VsZWN0aW9uRW5kKSB7XG4gICAgICAgICAgICAvLyBGb3IgbW9zdCBpbnRlcmFjdGlvbnMgd2UgZG9uJ3QgbmVlZCB0byBkbyBhbnl0aGluZyB0byBwcmVzZXJ2ZSB0aGUgY3Vyc29yIHBvc2l0aW9uLCBidXQgZm9yXG4gICAgICAgICAgICAvLyAnc2Nyb2xsJyBldmVudHMgd2UgZG8gKGJlY2F1c2UgdGhlIGludGVyYWN0aW9uIGlzbid0IGdvaW5nIHRvIHNldCBhIGN1cnNvciBwb3NpdGlvbiBuYXR1cmFsbHkpXG4gICAgICAgICAgICB0aGlzLnRleHRBcmVhLnNldFNlbGVjdGlvblJhbmdlKHByZXZTZWxlY3Rpb25TdGFydCwgcHJldlNlbGVjdGlvblN0YXJ0IC8qIG5vdCAnZW5kJyBiZWNhdXNlIHdlIHJlbW92ZWQgdGhlIHN1Z2dlc3Rpb24gKi8pO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zdWdnZXN0aW9uU3RhcnRQb3MgPSBudWxsO1xuICAgICAgICB0aGlzLnN1Z2dlc3Rpb25FbmRQb3MgPSBudWxsO1xuICAgICAgICB0aGlzLnRleHRBcmVhLnJlbW92ZUF0dHJpYnV0ZSgnZGF0YS1zdWdnZXN0aW9uLXZpc2libGUnKTtcbiAgICAgICAgdGhpcy5mYWtlQ2FyZXQ/LmhpZGUoKTtcbiAgICB9XG59XG5cbmNsYXNzIEZha2VDYXJldCB7XG4gICAgcmVhZG9ubHkgY2FyZXREaXY6IEhUTUxEaXZFbGVtZW50O1xuXG4gICAgY29uc3RydWN0b3Iob3duZXI6IFNtYXJ0VGV4dEFyZWEsIHByaXZhdGUgdGV4dEFyZWE6IEhUTUxUZXh0QXJlYUVsZW1lbnQpIHtcbiAgICAgICAgdGhpcy5jYXJldERpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICB0aGlzLmNhcmV0RGl2LmNsYXNzTGlzdC5hZGQoJ3NtYXJ0LXRleHRhcmVhLWNhcmV0Jyk7XG4gICAgICAgIG93bmVyLmFwcGVuZENoaWxkKHRoaXMuY2FyZXREaXYpO1xuICAgIH1cblxuICAgIHNob3coKSB7XG4gICAgICAgIGNvbnN0IGNhcmV0T2Zmc2V0ID0gZ2V0Q2FyZXRPZmZzZXRGcm9tT2Zmc2V0UGFyZW50KHRoaXMudGV4dEFyZWEpO1xuICAgICAgICBjb25zdCBzdHlsZSA9IHRoaXMuY2FyZXREaXYuc3R5bGU7XG4gICAgICAgIHN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICAgICAgICBzdHlsZS50b3AgPSBjYXJldE9mZnNldC50b3AgKyAncHgnO1xuICAgICAgICBzdHlsZS5sZWZ0ID0gY2FyZXRPZmZzZXQubGVmdCArICdweCc7XG4gICAgICAgIHN0eWxlLmhlaWdodCA9IGNhcmV0T2Zmc2V0LmhlaWdodCArICdweCc7XG4gICAgICAgIHN0eWxlLnpJbmRleCA9IHRoaXMudGV4dEFyZWEuc3R5bGUuekluZGV4O1xuICAgICAgICBzdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBjYXJldE9mZnNldC5lbGVtU3R5bGUuY2FyZXRDb2xvcjtcbiAgICB9XG5cbiAgICBoaWRlKCkge1xuICAgICAgICB0aGlzLmNhcmV0RGl2LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBmaW5kUHJvcGVydHlSZWN1cnNpdmUob2JqOiBhbnksIHByb3BOYW1lOiBzdHJpbmcpOiBQcm9wZXJ0eURlc2NyaXB0b3Ige1xuICAgIHdoaWxlIChvYmopIHtcbiAgICAgICAgY29uc3QgZGVzY3JpcHRvciA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3Iob2JqLCBwcm9wTmFtZSk7XG4gICAgICAgIGlmIChkZXNjcmlwdG9yKSB7XG4gICAgICAgICAgICByZXR1cm4gZGVzY3JpcHRvcjtcbiAgICAgICAgfVxuICAgICAgICBvYmogPSBPYmplY3QuZ2V0UHJvdG90eXBlT2Yob2JqKTtcbiAgICB9XG5cbiAgICB0aHJvdyBuZXcgRXJyb3IoYFByb3BlcnR5ICR7cHJvcE5hbWV9IG5vdCBmb3VuZCBvbiBvYmplY3Qgb3IgaXRzIHByb3RvdHlwZSBjaGFpbmApO1xufVxuIiwiaW1wb3J0IHsgU3VnZ2VzdGlvbkRpc3BsYXkgfSBmcm9tICcuL1N1Z2dlc3Rpb25EaXNwbGF5JztcbmltcG9ydCB7IFNtYXJ0VGV4dEFyZWEgfSBmcm9tICcuL1NtYXJ0VGV4dEFyZWEnO1xuaW1wb3J0IHsgZ2V0Q2FyZXRPZmZzZXRGcm9tT2Zmc2V0UGFyZW50LCBpbnNlcnRUZXh0QXRDYXJldFBvc2l0aW9uLCBzY3JvbGxUZXh0QXJlYURvd25Ub0NhcmV0SWZOZWVkZWQgfSBmcm9tICcuL0NhcmV0VXRpbCc7XG5cbmV4cG9ydCBjbGFzcyBPdmVybGF5U3VnZ2VzdGlvbkRpc3BsYXkgaW1wbGVtZW50cyBTdWdnZXN0aW9uRGlzcGxheSB7XG4gICAgbGF0ZXN0U3VnZ2VzdGlvblRleHQ6IHN0cmluZyA9ICcnO1xuICAgIHN1Z2dlc3Rpb25FbGVtZW50OiBIVE1MRGl2RWxlbWVudDtcbiAgICBzdWdnZXN0aW9uUHJlZml4RWxlbWVudDogSFRNTFNwYW5FbGVtZW50O1xuICAgIHN1Z2dlc3Rpb25UZXh0RWxlbWVudDogSFRNTFNwYW5FbGVtZW50O1xuICAgIHNob3dpbmc6IGJvb2xlYW47XG5cbiAgICBjb25zdHJ1Y3Rvcihvd25lcjogU21hcnRUZXh0QXJlYSwgcHJpdmF0ZSB0ZXh0QXJlYTogSFRNTFRleHRBcmVhRWxlbWVudCkge1xuICAgICAgICB0aGlzLnN1Z2dlc3Rpb25FbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIHRoaXMuc3VnZ2VzdGlvbkVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnc21hcnQtdGV4dGFyZWEtc3VnZ2VzdGlvbi1vdmVybGF5Jyk7XG4gICAgICAgIHRoaXMuc3VnZ2VzdGlvbkVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgZSA9PiB0aGlzLmhhbmRsZVN1Z2dlc3Rpb25DbGlja2VkKGUpKTtcbiAgICAgICAgdGhpcy5zdWdnZXN0aW9uRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIGUgPT4gdGhpcy5oYW5kbGVTdWdnZXN0aW9uQ2xpY2tlZChlKSk7XG5cbiAgICAgICAgdGhpcy5zdWdnZXN0aW9uUHJlZml4RWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgICAgICAgdGhpcy5zdWdnZXN0aW9uVGV4dEVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgICAgIHRoaXMuc3VnZ2VzdGlvbkVsZW1lbnQuYXBwZW5kQ2hpbGQodGhpcy5zdWdnZXN0aW9uUHJlZml4RWxlbWVudCk7XG4gICAgICAgIHRoaXMuc3VnZ2VzdGlvbkVsZW1lbnQuYXBwZW5kQ2hpbGQodGhpcy5zdWdnZXN0aW9uVGV4dEVsZW1lbnQpO1xuXG4gICAgICAgIHRoaXMuc3VnZ2VzdGlvblByZWZpeEVsZW1lbnQuc3R5bGUub3BhY2l0eSA9ICcwLjMnO1xuXG4gICAgICAgIGNvbnN0IGNvbXB1dGVkU3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLnRleHRBcmVhKTtcbiAgICAgICAgdGhpcy5zdWdnZXN0aW9uRWxlbWVudC5zdHlsZS5mb250ID0gY29tcHV0ZWRTdHlsZS5mb250O1xuICAgICAgICB0aGlzLnN1Z2dlc3Rpb25FbGVtZW50LnN0eWxlLm1hcmdpblRvcCA9IChwYXJzZUZsb2F0KGNvbXB1dGVkU3R5bGUuZm9udFNpemUpICogMS40KSArICdweCc7XG5cbiAgICAgICAgb3duZXIuYXBwZW5kQ2hpbGQodGhpcy5zdWdnZXN0aW9uRWxlbWVudCk7XG4gICAgfVxuXG4gICAgZ2V0IGN1cnJlbnRTdWdnZXN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5sYXRlc3RTdWdnZXN0aW9uVGV4dDtcbiAgICB9XG5cbiAgICBzaG93KHN1Z2dlc3Rpb246IHN0cmluZyk6IHZvaWQge1xuICAgICAgICB0aGlzLmxhdGVzdFN1Z2dlc3Rpb25UZXh0ID0gc3VnZ2VzdGlvbjtcblxuICAgICAgICB0aGlzLnN1Z2dlc3Rpb25QcmVmaXhFbGVtZW50LnRleHRDb250ZW50ID0gc3VnZ2VzdGlvblswXSAhPSAnICcgPyBnZXRDdXJyZW50SW5jb21wbGV0ZVdvcmQodGhpcy50ZXh0QXJlYSwgMjApIDogJyc7XG4gICAgICAgIHRoaXMuc3VnZ2VzdGlvblRleHRFbGVtZW50LnRleHRDb250ZW50ID0gc3VnZ2VzdGlvbjtcblxuICAgICAgICBjb25zdCBjYXJldE9mZnNldCA9IGdldENhcmV0T2Zmc2V0RnJvbU9mZnNldFBhcmVudCh0aGlzLnRleHRBcmVhKTtcbiAgICAgICAgY29uc3Qgc3R5bGUgPSB0aGlzLnN1Z2dlc3Rpb25FbGVtZW50LnN0eWxlO1xuICAgICAgICBzdHlsZS5taW5XaWR0aCA9IG51bGw7XG4gICAgICAgIHRoaXMuc3VnZ2VzdGlvbkVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnc21hcnQtdGV4dGFyZWEtc3VnZ2VzdGlvbi1vdmVybGF5LXZpc2libGUnKTtcbiAgICAgICAgc3R5bGUuekluZGV4ID0gdGhpcy50ZXh0QXJlYS5zdHlsZS56SW5kZXg7XG4gICAgICAgIHN0eWxlLnRvcCA9IGNhcmV0T2Zmc2V0LnRvcCArICdweCc7XG5cbiAgICAgICAgLy8gSWYgdGhlIGhvcml6b250YWwgcG9zaXRpb24gaXMgYWxyZWFkeSBjbG9zZSBlbm91Z2gsIGxlYXZlIGl0IGFsb25lLiBPdGhlcndpc2UgaXRcbiAgICAgICAgLy8gY2FuIGppZ2dsZSBhbm5veWluZ2x5IGR1ZSB0byBpbmFjY3VyYWNpZXMgaW4gbWVhc3VyaW5nIHRoZSBjYXJldCBwb3NpdGlvbi5cbiAgICAgICAgY29uc3QgbmV3TGVmdFBvcyA9IGNhcmV0T2Zmc2V0LmxlZnQgLSB0aGlzLnN1Z2dlc3Rpb25QcmVmaXhFbGVtZW50Lm9mZnNldFdpZHRoO1xuICAgICAgICBpZiAoIXN0eWxlLmxlZnQgfHwgTWF0aC5hYnMocGFyc2VGbG9hdChzdHlsZS5sZWZ0KSAtIG5ld0xlZnRQb3MpID4gMTApIHtcbiAgICAgICAgICAgIHN0eWxlLmxlZnQgPSBuZXdMZWZ0UG9zICsgJ3B4JztcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2hvd2luZyA9IHRydWU7XG5cblxuICAgICAgICAvLyBOb3JtYWxseSB3ZSdyZSBoYXBweSBmb3IgdGhlIG92ZXJsYXkgdG8gdGFrZSB1cCBhcyBtdWNoIHdpZHRoIGFzIGl0IGNhbiB1cCB0byB0aGUgZWRnZSBvZiB0aGUgcGFnZS5cbiAgICAgICAgLy8gSG93ZXZlciwgaWYgaXQncyB0b28gbmFycm93IChiZWNhdXNlIHRoZSBlZGdlIG9mIHRoZSBwYWdlIGlzIGFscmVhZHkgdG9vIGNsb3NlKSwgaXQgd2lsbCB3cmFwIG9udG9cbiAgICAgICAgLy8gbWFueSBsaW5lcy4gSW4gdGhpcyBjYXNlIHdlJ2xsIGZvcmNlIGl0IHRvIGdldCB3aWRlciwgYW5kIHRoZW4gd2UgaGF2ZSB0byBtb3ZlIGl0IGZ1cnRoZXIgbGVmdCB0b1xuICAgICAgICAvLyBhdm9pZCBzcGlsbGluZyBvZmYgdGhlIHNjcmVlbi5cbiAgICAgICAgY29uc3Qgc3VnZ2VzdGlvbkNvbXB1dGVkU3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLnN1Z2dlc3Rpb25FbGVtZW50KTtcbiAgICAgICAgY29uc3QgbnVtTGluZXNPZlRleHQgPSBNYXRoLnJvdW5kKCh0aGlzLnN1Z2dlc3Rpb25FbGVtZW50Lm9mZnNldEhlaWdodCAtIHBhcnNlRmxvYXQoc3VnZ2VzdGlvbkNvbXB1dGVkU3R5bGUucGFkZGluZ1RvcCkgLSBwYXJzZUZsb2F0KHN1Z2dlc3Rpb25Db21wdXRlZFN0eWxlLnBhZGRpbmdCb3R0b20pKVxuICAgICAgICAgICAgLyBwYXJzZUZsb2F0KHN1Z2dlc3Rpb25Db21wdXRlZFN0eWxlLmxpbmVIZWlnaHQpKTtcbiAgICAgICAgaWYgKG51bUxpbmVzT2ZUZXh0ID4gMikge1xuICAgICAgICAgICAgY29uc3Qgb2xkV2lkdGggPSB0aGlzLnN1Z2dlc3Rpb25FbGVtZW50Lm9mZnNldFdpZHRoO1xuICAgICAgICAgICAgc3R5bGUubWluV2lkdGggPSBgY2FsYyhtaW4oNzB2dywgJHsgKG51bUxpbmVzT2ZUZXh0ICogb2xkV2lkdGggLyAyKSB9cHgpKWA7IC8vIEFpbSBmb3IgMiBsaW5lcywgYnV0IGRvbid0IGdldCB3aWRlciB0aGFuIDcwJSBvZiB0aGUgc2NyZWVuXG4gICAgICAgIH1cblxuICAgICAgICAvLyBJZiB0aGUgc3VnZ2VzdGlvbiBpcyB0b28gZmFyIHRvIHRoZSByaWdodCwgbW92ZSBpdCBsZWZ0IHNvIGl0J3Mgbm90IG9mZiB0aGUgc2NyZWVuXG4gICAgICAgIGNvbnN0IHN1Z2dlc3Rpb25DbGllbnRSZWN0ID0gdGhpcy5zdWdnZXN0aW9uRWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgICAgaWYgKHN1Z2dlc3Rpb25DbGllbnRSZWN0LnJpZ2h0ID4gZG9jdW1lbnQuYm9keS5jbGllbnRXaWR0aCAtIDIwKSB7XG4gICAgICAgICAgICBzdHlsZS5sZWZ0ID0gYGNhbGMoJHtwYXJzZUZsb2F0KHN0eWxlLmxlZnQpIC0gKHN1Z2dlc3Rpb25DbGllbnRSZWN0LnJpZ2h0IC0gZG9jdW1lbnQuYm9keS5jbGllbnRXaWR0aCl9cHggLSAycmVtKWA7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhY2NlcHQoKTogdm9pZCB7XG4gICAgICAgIGlmICghdGhpcy5zaG93aW5nKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpbnNlcnRUZXh0QXRDYXJldFBvc2l0aW9uKHRoaXMudGV4dEFyZWEsIHRoaXMuY3VycmVudFN1Z2dlc3Rpb24pO1xuXG4gICAgICAgIC8vIFRoZSBuZXdseS1pbnNlcnRlZCB0ZXh0IGNvdWxkIGJlIHNvIGxvbmcgdGhhdCB0aGUgbmV3IGNhcmV0IHBvc2l0aW9uIGlzIG9mZiB0aGUgYm90dG9tIG9mIHRoZSB0ZXh0YXJlYS5cbiAgICAgICAgLy8gSXQgd29uJ3Qgc2Nyb2xsIHRvIHRoZSBuZXcgY2FyZXQgcG9zaXRpb24gYnkgZGVmYXVsdFxuICAgICAgICBzY3JvbGxUZXh0QXJlYURvd25Ub0NhcmV0SWZOZWVkZWQodGhpcy50ZXh0QXJlYSk7XG5cbiAgICAgICAgdGhpcy5oaWRlKCk7XG4gICAgfVxuXG4gICAgcmVqZWN0KCk6IHZvaWQge1xuICAgICAgICB0aGlzLmhpZGUoKTtcbiAgICB9XG5cbiAgICBoaWRlKCk6IHZvaWQge1xuICAgICAgICBpZiAodGhpcy5zaG93aW5nKSB7XG4gICAgICAgICAgICB0aGlzLnNob3dpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuc3VnZ2VzdGlvbkVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnc21hcnQtdGV4dGFyZWEtc3VnZ2VzdGlvbi1vdmVybGF5LXZpc2libGUnKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlzU2hvd2luZygpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2hvd2luZztcbiAgICB9XG5cbiAgICBoYW5kbGVTdWdnZXN0aW9uQ2xpY2tlZChldmVudDogRXZlbnQpIHtcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG4gICAgICAgIHRoaXMuYWNjZXB0KCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBnZXRDdXJyZW50SW5jb21wbGV0ZVdvcmQodGV4dEFyZWE6IEhUTUxUZXh0QXJlYUVsZW1lbnQsIG1heExlbmd0aDogbnVtYmVyKSB7XG4gICAgY29uc3QgdGV4dCA9IHRleHRBcmVhLnZhbHVlO1xuICAgIGNvbnN0IGNhcmV0UG9zID0gdGV4dEFyZWEuc2VsZWN0aW9uU3RhcnQ7XG5cbiAgICAvLyBOb3QgYWxsIGxhbmd1YWdlcyBoYXZlIHdvcmRzIHNlcGFyYXRlZCBieSBzcGFjZXMuIEltcG9zaW5nIHRoZSBtYXhsZW5ndGggcnVsZVxuICAgIC8vIG1lYW5zIHdlJ2xsIG5vdCBzaG93IHRoZSBwcmVmaXggZm9yIHRob3NlIGxhbmd1YWdlcyBpZiB5b3UncmUgaW4gdGhlIG1pZGRsZVxuICAgIC8vIG9mIGxvbmdlciB0ZXh0IChhbmQgZW5zdXJlcyB3ZSBkb24ndCBzZWFyY2ggdGhyb3VnaCBhIGxvbmcgYmxvY2spLCB3aGljaCBpcyBpZGVhbC5cbiAgICBmb3IgKGxldCBpID0gY2FyZXRQb3MgLSAxOyBpID4gY2FyZXRQb3MgLSBtYXhMZW5ndGg7IGktLSkge1xuICAgICAgICBpZiAoaSA8IDAgfHwgdGV4dFtpXS5tYXRjaCgvXFxzLykpIHtcbiAgICAgICAgICAgIHJldHVybiB0ZXh0LnN1YnN0cmluZyhpICsgMSwgY2FyZXRQb3MpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuICcnO1xufVxuIiwiaW1wb3J0IHsgU3VnZ2VzdGlvbkRpc3BsYXkgfSBmcm9tICcuL1N1Z2dlc3Rpb25EaXNwbGF5JztcbmltcG9ydCB7IElubGluZVN1Z2dlc3Rpb25EaXNwbGF5IH0gZnJvbSAnLi9JbmxpbmVTdWdnZXN0aW9uRGlzcGxheSc7XG5pbXBvcnQgeyBPdmVybGF5U3VnZ2VzdGlvbkRpc3BsYXkgfSBmcm9tICcuL092ZXJsYXlTdWdnZXN0aW9uRGlzcGxheSc7XG5pbXBvcnQgeyBpbnNlcnRUZXh0QXRDYXJldFBvc2l0aW9uLCBzY3JvbGxUZXh0QXJlYURvd25Ub0NhcmV0SWZOZWVkZWQgfSBmcm9tICcuL0NhcmV0VXRpbCc7XG5cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlclNtYXJ0VGV4dEFyZWFDdXN0b21FbGVtZW50KCkge1xuICAgIGN1c3RvbUVsZW1lbnRzLmRlZmluZSgnc21hcnQtdGV4dGFyZWEnLCBTbWFydFRleHRBcmVhKTtcbn1cblxuZXhwb3J0IGNsYXNzIFNtYXJ0VGV4dEFyZWEgZXh0ZW5kcyBIVE1MRWxlbWVudCB7XG4gICAgdHlwaW5nRGVib3VuY2VUaW1lb3V0OiBudW1iZXIgfCBudWxsID0gbnVsbDtcbiAgICB0ZXh0QXJlYTogSFRNTFRleHRBcmVhRWxlbWVudDtcbiAgICBzdWdnZXN0aW9uRGlzcGxheTogU3VnZ2VzdGlvbkRpc3BsYXk7XG4gICAgcGVuZGluZ1N1Z2dlc3Rpb25BYm9ydENvbnRyb2xsZXI/OiBBYm9ydENvbnRyb2xsZXI7XG5cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgaWYgKCEodGhpcy5wcmV2aW91c0VsZW1lbnRTaWJsaW5nIGluc3RhbmNlb2YgSFRNTFRleHRBcmVhRWxlbWVudCkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignc21hcnQtdGV4dGFyZWEgbXVzdCBiZSByZW5kZXJlZCBpbW1lZGlhdGVseSBhZnRlciBhIHRleHRhcmVhIGVsZW1lbnQnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMudGV4dEFyZWEgPSB0aGlzLnByZXZpb3VzRWxlbWVudFNpYmxpbmcgYXMgSFRNTFRleHRBcmVhRWxlbWVudDtcbiAgICAgICAgdGhpcy5zdWdnZXN0aW9uRGlzcGxheSA9IHNob3VsZFVzZUlubGluZVN1Z2dlc3Rpb25zKHRoaXMudGV4dEFyZWEpXG4gICAgICAgICAgICA/IG5ldyBJbmxpbmVTdWdnZXN0aW9uRGlzcGxheSh0aGlzLCB0aGlzLnRleHRBcmVhKVxuICAgICAgICAgICAgOiBuZXcgT3ZlcmxheVN1Z2dlc3Rpb25EaXNwbGF5KHRoaXMsIHRoaXMudGV4dEFyZWEpO1xuXG4gICAgICAgIHRoaXMudGV4dEFyZWEuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGUgPT4gdGhpcy5oYW5kbGVLZXlEb3duKGUpKTtcbiAgICAgICAgdGhpcy50ZXh0QXJlYS5hZGRFdmVudExpc3RlbmVyKCdrZXl1cCcsIGUgPT4gdGhpcy5oYW5kbGVLZXlVcChlKSk7XG4gICAgICAgIHRoaXMudGV4dEFyZWEuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgKCkgPT4gdGhpcy5yZW1vdmVFeGlzdGluZ09yUGVuZGluZ1N1Z2dlc3Rpb24oKSk7XG4gICAgICAgIHRoaXMudGV4dEFyZWEuYWRkRXZlbnRMaXN0ZW5lcignZm9jdXNvdXQnLCAoKSA9PiB0aGlzLnJlbW92ZUV4aXN0aW5nT3JQZW5kaW5nU3VnZ2VzdGlvbigpKTtcblxuICAgICAgICAvLyBJZiB5b3Ugc2Nyb2xsLCB3ZSBkb24ndCBuZWVkIHRvIGtpbGwgYW55IHBlbmRpbmcgc3VnZ2VzdGlvbiByZXF1ZXN0LCBidXQgd2UgZG8gbmVlZCB0byBoaWRlXG4gICAgICAgIC8vIGFueSBzdWdnZXN0aW9uIHRoYXQncyBhbHJlYWR5IHZpc2libGUgYmVjYXVzZSB0aGUgZmFrZSBjdXJzb3Igd2lsbCBub3cgYmUgaW4gdGhlIHdyb25nIHBsYWNlXG4gICAgICAgIHRoaXMudGV4dEFyZWEuYWRkRXZlbnRMaXN0ZW5lcignc2Nyb2xsJywgKCkgPT4gdGhpcy5zdWdnZXN0aW9uRGlzcGxheS5yZWplY3QoKSwgeyBwYXNzaXZlOiB0cnVlIH0pO1xuICAgIH1cblxuICAgIGhhbmRsZUtleURvd24oZXZlbnQ6IEtleWJvYXJkRXZlbnQpIHtcbiAgICAgICAgc3dpdGNoIChldmVudC5rZXkpIHtcbiAgICAgICAgICAgIGNhc2UgJ1RhYic6XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc3VnZ2VzdGlvbkRpc3BsYXkuaXNTaG93aW5nKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdWdnZXN0aW9uRGlzcGxheS5hY2NlcHQoKTtcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdBbHQnOlxuICAgICAgICAgICAgY2FzZSAnQ29udHJvbCc6XG4gICAgICAgICAgICBjYXNlICdTaGlmdCc6XG4gICAgICAgICAgICBjYXNlICdDb21tYW5kJzpcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgY29uc3Qga2V5TWF0Y2hlc0V4aXN0aW5nU3VnZ2VzdGlvbiA9IHRoaXMuc3VnZ2VzdGlvbkRpc3BsYXkuaXNTaG93aW5nKClcbiAgICAgICAgICAgICAgICAgICAgJiYgdGhpcy5zdWdnZXN0aW9uRGlzcGxheS5jdXJyZW50U3VnZ2VzdGlvbi5zdGFydHNXaXRoKGV2ZW50LmtleSk7XG4gICAgICAgICAgICAgICAgaWYgKGtleU1hdGNoZXNFeGlzdGluZ1N1Z2dlc3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gTGV0IHRoZSB0eXBpbmcgaGFwcGVuLCBidXQgd2l0aG91dCBzaWRlLWVmZmVjdHMgbGlrZSByZW1vdmluZyB0aGUgZXhpc3Rpbmcgc2VsZWN0aW9uXG4gICAgICAgICAgICAgICAgICAgIGluc2VydFRleHRBdENhcmV0UG9zaXRpb24odGhpcy50ZXh0QXJlYSwgZXZlbnQua2V5KTtcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBVcGRhdGUgdGhlIGV4aXN0aW5nIHN1Z2dlc3Rpb24gdG8gbWF0Y2ggdGhlIG5ldyB0ZXh0XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3VnZ2VzdGlvbkRpc3BsYXkuc2hvdyh0aGlzLnN1Z2dlc3Rpb25EaXNwbGF5LmN1cnJlbnRTdWdnZXN0aW9uLnN1YnN0cmluZyhldmVudC5rZXkubGVuZ3RoKSk7XG4gICAgICAgICAgICAgICAgICAgIHNjcm9sbFRleHRBcmVhRG93blRvQ2FyZXRJZk5lZWRlZCh0aGlzLnRleHRBcmVhKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbW92ZUV4aXN0aW5nT3JQZW5kaW5nU3VnZ2VzdGlvbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGtleU1hdGNoZXNFeGlzdGluZ1N1Z2dlc3Rpb24oa2V5OiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIDtcbiAgICB9XG5cbiAgICAvLyBJZiB0aGlzIHdhcyBjaGFuZ2VkIHRvIGEgJ2tleXByZXNzJyBldmVudCBpbnN0ZWFkLCB3ZSdkIG9ubHkgaW5pdGlhdGUgc3VnZ2VzdGlvbnMgYWZ0ZXJcbiAgICAvLyB0aGUgdXNlciB0eXBlcyBhIHZpc2libGUgY2hhcmFjdGVyLCBub3QgcHJlc3NpbmcgYW5vdGhlciBrZXkgKGUuZy4sIGFycm93cywgb3IgY3RybCtjKS5cbiAgICAvLyBIb3dldmVyIGZvciBub3cgSSB0aGluayBpdCBpcyBkZXNpcmFibGUgdG8gc2hvdyBzdWdnZXN0aW9ucyBhZnRlciBjdXJzb3IgbW92ZW1lbnQuXG4gICAgaGFuZGxlS2V5VXAoZXZlbnQ6IEtleWJvYXJkRXZlbnQpIHtcbiAgICAgICAgLy8gSWYgYSBzdWdnZXN0aW9uIGlzIGFscmVhZHkgdmlzaWJsZSwgaXQgbXVzdCBtYXRjaCB0aGUgY3VycmVudCBrZXlzdHJva2Ugb3IgaXQgd291bGRcbiAgICAgICAgLy8gYWxyZWFkeSBoYXZlIGJlZW4gcmVtb3ZlZCBkdXJpbmcga2V5ZG93bi4gU28gd2Ugb25seSBzdGFydCB0aGUgdGltZW91dCBwcm9jZXNzIGlmXG4gICAgICAgIC8vIHRoZXJlJ3Mgbm8gdmlzaWJsZSBzdWdnZXN0aW9uLlxuICAgICAgICBpZiAoIXRoaXMuc3VnZ2VzdGlvbkRpc3BsYXkuaXNTaG93aW5nKCkpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aGlzLnR5cGluZ0RlYm91bmNlVGltZW91dCk7XG4gICAgICAgICAgICB0aGlzLnR5cGluZ0RlYm91bmNlVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4gdGhpcy5oYW5kbGVUeXBpbmdQYXVzZWQoKSwgMzUwKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGhhbmRsZVR5cGluZ1BhdXNlZCgpIHtcbiAgICAgICAgaWYgKGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgIT09IHRoaXMudGV4dEFyZWEpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFdlIG9ubHkgc2hvdyBhIHN1Z2dlc3Rpb24gaWYgdGhlIGN1cnNvciBpcyBhdCB0aGUgZW5kIG9mIHRoZSBjdXJyZW50IGxpbmUuIEluc2VydGluZyBzdWdnZXN0aW9ucyBpblxuICAgICAgICAvLyB0aGUgbWlkZGxlIG9mIGEgbGluZSBpcyBjb25mdXNpbmcgKHRoaW5ncyBtb3ZlIGFyb3VuZCBpbiB1bnVzdWFsIHdheXMpLlxuICAgICAgICAvLyBUT0RPOiBZb3UgY291bGQgYWxzbyBhbGxvdyB0aGUgY2FzZSB3aGVyZSBhbGwgcmVtYWluaW5nIHRleHQgb24gdGhlIGN1cnJlbnQgbGluZSBpcyB3aGl0ZXNwYWNlXG4gICAgICAgIGNvbnN0IGlzQXRFbmRPZkN1cnJlbnRMaW5lID0gdGhpcy50ZXh0QXJlYS5zZWxlY3Rpb25TdGFydCA9PT0gdGhpcy50ZXh0QXJlYS5zZWxlY3Rpb25FbmRcbiAgICAgICAgICAgICYmICh0aGlzLnRleHRBcmVhLnNlbGVjdGlvblN0YXJ0ID09PSB0aGlzLnRleHRBcmVhLnZhbHVlLmxlbmd0aCB8fCB0aGlzLnRleHRBcmVhLnZhbHVlW3RoaXMudGV4dEFyZWEuc2VsZWN0aW9uU3RhcnRdID09PSAnXFxuJyk7XG4gICAgICAgIGlmICghaXNBdEVuZE9mQ3VycmVudExpbmUpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucmVxdWVzdFN1Z2dlc3Rpb25Bc3luYygpO1xuICAgIH1cblxuICAgIHJlbW92ZUV4aXN0aW5nT3JQZW5kaW5nU3VnZ2VzdGlvbigpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMudHlwaW5nRGVib3VuY2VUaW1lb3V0KTtcblxuICAgICAgICB0aGlzLnBlbmRpbmdTdWdnZXN0aW9uQWJvcnRDb250cm9sbGVyPy5hYm9ydCgpO1xuICAgICAgICB0aGlzLnBlbmRpbmdTdWdnZXN0aW9uQWJvcnRDb250cm9sbGVyID0gbnVsbDtcblxuICAgICAgICB0aGlzLnN1Z2dlc3Rpb25EaXNwbGF5LnJlamVjdCgpO1xuICAgIH1cblxuICAgIGFzeW5jIHJlcXVlc3RTdWdnZXN0aW9uQXN5bmMoKSB7XG4gICAgICAgIHRoaXMucGVuZGluZ1N1Z2dlc3Rpb25BYm9ydENvbnRyb2xsZXI/LmFib3J0KCk7XG4gICAgICAgIHRoaXMucGVuZGluZ1N1Z2dlc3Rpb25BYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG5cbiAgICAgICAgY29uc3Qgc25hcHNob3QgPSB7XG4gICAgICAgICAgICBhYm9ydFNpZ25hbDogdGhpcy5wZW5kaW5nU3VnZ2VzdGlvbkFib3J0Q29udHJvbGxlci5zaWduYWwsXG4gICAgICAgICAgICB0ZXh0QXJlYVZhbHVlOiB0aGlzLnRleHRBcmVhLnZhbHVlLFxuICAgICAgICAgICAgY3Vyc29yUG9zaXRpb246IHRoaXMudGV4dEFyZWEuc2VsZWN0aW9uU3RhcnQsXG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgYm9keSA9IHtcbiAgICAgICAgICAgIC8vIFRPRE86IExpbWl0IHRoZSBhbW91bnQgb2YgdGV4dCB3ZSBzZW5kLCBlLmcuLCB0byAxMDAgY2hhcmFjdGVycyBiZWZvcmUgYW5kIGFmdGVyIHRoZSBjdXJzb3JcbiAgICAgICAgICAgIHRleHRCZWZvcmU6IHNuYXBzaG90LnRleHRBcmVhVmFsdWUuc3Vic3RyaW5nKDAsIHNuYXBzaG90LmN1cnNvclBvc2l0aW9uKSxcbiAgICAgICAgICAgIHRleHRBZnRlcjogc25hcHNob3QudGV4dEFyZWFWYWx1ZS5zdWJzdHJpbmcoc25hcHNob3QuY3Vyc29yUG9zaXRpb24pLFxuICAgICAgICAgICAgY29uZmlnOiB0aGlzLmdldEF0dHJpYnV0ZSgnZGF0YS1jb25maWcnKSxcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCBhbnRpZm9yZ2VyeU5hbWUgPSB0aGlzLmdldEF0dHJpYnV0ZSgnZGF0YS1hbnRpZm9yZ2VyeS1uYW1lJyk7XG4gICAgICAgIGlmIChhbnRpZm9yZ2VyeU5hbWUpIHtcbiAgICAgICAgICAgIGJvZHlbYW50aWZvcmdlcnlOYW1lXSA9IHRoaXMuZ2V0QXR0cmlidXRlKCdkYXRhLWFudGlmb3JnZXJ5LXZhbHVlJyk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCByZXF1ZXN0SW5pdDogUmVxdWVzdEluaXQgPSB7XG4gICAgICAgICAgICBtZXRob2Q6ICdwb3N0JyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYm9keTogbmV3IFVSTFNlYXJjaFBhcmFtcyhib2R5KSxcbiAgICAgICAgICAgIHNpZ25hbDogc25hcHNob3QuYWJvcnRTaWduYWwsXG4gICAgICAgIH07XG5cbiAgICAgICAgbGV0IHN1Z2dlc3Rpb25UZXh0OiBzdHJpbmc7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXZSByZWx5IG9uIHRoZSBVUkwgYmVpbmcgcGF0aGJhc2UtcmVsYXRpdmUgZm9yIEJsYXpvciwgb3IgYSB+Ly4uLiBVUkwgdGhhdCB3b3VsZCBhbHJlYWR5XG4gICAgICAgICAgICAvLyBiZSByZXNvbHZlZCBvbiB0aGUgc2VydmVyIGZvciBNVkNcbiAgICAgICAgICAgIGNvbnN0IGh0dHBSZXNwb25zZSA9IGF3YWl0IGZldGNoKHRoaXMuZ2V0QXR0cmlidXRlKCdkYXRhLXVybCcpLCByZXF1ZXN0SW5pdCk7XG4gICAgICAgICAgICBzdWdnZXN0aW9uVGV4dCA9IGh0dHBSZXNwb25zZS5vayA/IGF3YWl0IGh0dHBSZXNwb25zZS50ZXh0KCkgOiBudWxsO1xuICAgICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICAgICAgaWYgKGV4IGluc3RhbmNlb2YgRE9NRXhjZXB0aW9uICYmIGV4Lm5hbWUgPT09ICdBYm9ydEVycm9yJykge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIE5vcm1hbGx5IGlmIHRoZSB1c2VyIGhhcyBtYWRlIGZ1cnRoZXIgZWRpdHMgaW4gdGhlIHRleHRhcmVhLCBvdXIgSFRUUCByZXF1ZXN0IHdvdWxkIGFscmVhZHlcbiAgICAgICAgLy8gaGF2ZSBiZWVuIGFib3J0ZWQgc28gd2Ugd291bGRuJ3QgZ2V0IGhlcmUuIEJ1dCBpZiBzb21ldGhpbmcgZWxzZSAoZS5nLiwgc29tZSBvdGhlciBKUyBjb2RlKVxuICAgICAgICAvLyBtdXRhdGVzIHRoZSB0ZXh0YXJlYSwgd2Ugd291bGQgc3RpbGwgZ2V0IGhlcmUuIEl0J3MgaW1wb3J0YW50IHdlIGRvbid0IGFwcGx5IHRoZSBzdWdnZXN0aW9uXG4gICAgICAgIC8vIGlmIHRoZSB0ZXh0YXJlYSB2YWx1ZSBvciBjdXJzb3IgcG9zaXRpb24gaGFzIGNoYW5nZWQsIHNvIGNvbXBhcmUgYWdhaW5zdCBvdXIgc25hcHNob3QuXG4gICAgICAgIGlmIChzdWdnZXN0aW9uVGV4dFxuICAgICAgICAgICAgJiYgc25hcHNob3QudGV4dEFyZWFWYWx1ZSA9PT0gdGhpcy50ZXh0QXJlYS52YWx1ZVxuICAgICAgICAgICAgJiYgc25hcHNob3QuY3Vyc29yUG9zaXRpb24gPT09IHRoaXMudGV4dEFyZWEuc2VsZWN0aW9uU3RhcnQpIHtcbiAgICAgICAgICAgIGlmICghc3VnZ2VzdGlvblRleHQuZW5kc1dpdGgoJyAnKSkge1xuICAgICAgICAgICAgICAgIHN1Z2dlc3Rpb25UZXh0ICs9ICcgJztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5zdWdnZXN0aW9uRGlzcGxheS5zaG93KHN1Z2dlc3Rpb25UZXh0KTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gc2hvdWxkVXNlSW5saW5lU3VnZ2VzdGlvbnModGV4dEFyZWE6IEhUTUxUZXh0QXJlYUVsZW1lbnQpOiBib29sZWFuIHtcbiAgICAvLyBBbGxvdyB0aGUgZGV2ZWxvcGVyIHRvIHNwZWNpZnkgdGhpcyBleHBsaWNpdGx5IGlmIHRoZXkgd2FudFxuICAgIGNvbnN0IGV4cGxpY2l0Q29uZmlnID0gdGV4dEFyZWEuZ2V0QXR0cmlidXRlKCdkYXRhLWlubGluZS1zdWdnZXN0aW9ucycpO1xuICAgIGlmIChleHBsaWNpdENvbmZpZykge1xuICAgICAgICByZXR1cm4gZXhwbGljaXRDb25maWcudG9Mb3dlckNhc2UoKSA9PT0gJ3RydWUnO1xuICAgIH1cblxuICAgIC8vIC4uLiBidXQgYnkgZGVmYXVsdCwgd2UgdXNlIG92ZXJsYXkgb24gdG91Y2ggZGV2aWNlcywgaW5saW5lIG9uIG5vbi10b3VjaCBkZXZpY2VzXG4gICAgLy8gVGhhdCdzIGJlY2F1c2U6XG4gICAgLy8gIC0gTW9iaWxlIGRldmljZXMgd2lsbCBiZSB0b3VjaCwgYW5kIG1vc3QgbW9iaWxlIHVzZXJzIGRvbid0IGhhdmUgYSBcInRhYlwiIGtleSBieSB3aGljaCB0byBhY2NlcHQgaW5saW5lIHN1Z2dlc3Rpb25zXG4gICAgLy8gIC0gTW9iaWxlIGRldmljZXMgc3VjaCBhcyBpT1Mgd2lsbCBkaXNwbGF5IGFsbCBraW5kcyBvZiBleHRyYSBVSSBhcm91bmQgc2VsZWN0ZWQgdGV4dCAoZS5nLiwgc2VsZWN0aW9uIGhhbmRsZXMpLFxuICAgIC8vICAgIHdoaWNoIHdvdWxkIGxvb2sgY29tcGxldGVseSB3cm9uZ1xuICAgIC8vIEluIGdlbmVyYWwsIHRoZSBvdmVybGF5IGFwcHJvYWNoIGlzIHRoZSByaXNrLWF2ZXJzZSBvbmUgdGhhdCB3b3JrcyBldmVyeXdoZXJlLCBldmVuIHRob3VnaCBpdCdzIG5vdCBhcyBhdHRyYWN0aXZlLlxuICAgIGNvbnN0IGlzVG91Y2ggPSAnb250b3VjaHN0YXJ0JyBpbiB3aW5kb3c7IC8vIFRydWUgZm9yIGFueSBtb2JpbGUuIFVzdWFsbHkgbm90IHRydWUgZm9yIGRlc2t0b3AuXG4gICAgcmV0dXJuICFpc1RvdWNoO1xufVxuIiwiaW1wb3J0IHsgcmVnaXN0ZXJTbWFydENvbWJvQm94Q3VzdG9tRWxlbWVudCB9IGZyb20gJy4vU21hcnRDb21ib0JveCc7XG5pbXBvcnQgeyByZWdpc3RlclNtYXJ0UGFzdGVDbGlja0hhbmRsZXIgfSBmcm9tICcuL1NtYXJ0UGFzdGUnO1xuaW1wb3J0IHsgcmVnaXN0ZXJTbWFydFRleHRBcmVhQ3VzdG9tRWxlbWVudCB9IGZyb20gJy4vU21hcnRUZXh0QXJlYS9TbWFydFRleHRBcmVhJztcblxuLy8gT25seSBydW4gdGhpcyBzY3JpcHQgb25jZS4gSWYgeW91IGltcG9ydCBpdCBtdWx0aXBsZSB0aW1lcywgdGhlIDJuZC1hbmQtbGF0ZXIgYXJlIG5vLW9wcy5cbmNvbnN0IGlzTG9hZGVkTWFya2VyID0gJ19fc21hcnRfY29tcG9uZW50c19sb2FkZWRfXyc7XG5pZiAoIU9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoZG9jdW1lbnQsIGlzTG9hZGVkTWFya2VyKSkge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShkb2N1bWVudCwgaXNMb2FkZWRNYXJrZXIsIHsgZW51bWVyYWJsZTogZmFsc2UsIHdyaXRhYmxlOiBmYWxzZSB9KTtcblxuICAgIHJlZ2lzdGVyU21hcnRDb21ib0JveEN1c3RvbUVsZW1lbnQoKTtcbiAgICByZWdpc3RlclNtYXJ0UGFzdGVDbGlja0hhbmRsZXIoKTtcbiAgICByZWdpc3RlclNtYXJ0VGV4dEFyZWFDdXN0b21FbGVtZW50KCk7XG59XG4iXSwibmFtZXMiOlsiY2FyZXRQb3MucG9zaXRpb24iXSwibWFwcGluZ3MiOiJBQUFnQixTQUFBLDZCQUE2QixDQUFDLElBQWdFLEVBQUUsS0FBdUIsRUFBQTtBQUNuSSxJQUFBLElBQUksSUFBSSxZQUFZLGlCQUFpQixFQUFFO0FBQ25DLFFBQUEsTUFBTSxhQUFhLEdBQUcsS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ3ZDLE1BQU0sZ0JBQWdCLEdBQUcsc0JBQXNCLENBQUMsSUFBSSxFQUFFLGFBQWEsQ0FBQyxDQUFDO1FBQ3JFLElBQUksZ0JBQWdCLEtBQUssSUFBSSxJQUFJLElBQUksQ0FBQyxhQUFhLEtBQUssZ0JBQWdCLEVBQUU7WUFDdEUsOEJBQThCLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDckMsWUFBQSxJQUFJLENBQUMsYUFBYSxHQUFHLGdCQUFnQixDQUFDO1lBQ3RDLHdCQUF3QixDQUFDLElBQUksQ0FBQyxDQUFDO1NBQ2xDO0tBQ0o7QUFBTSxTQUFBLElBQUksSUFBSSxZQUFZLGdCQUFnQixLQUFLLElBQUksQ0FBQyxJQUFJLEtBQUssT0FBTyxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssVUFBVSxDQUFDLEVBQUU7QUFDaEcsUUFBQSxNQUFNLGdCQUFnQixHQUFHLEtBQUssS0FBQSxJQUFBLElBQUwsS0FBSyxLQUFBLEtBQUEsQ0FBQSxHQUFBLEtBQUEsQ0FBQSxHQUFMLEtBQUssQ0FBRSxRQUFRLEVBQUEsQ0FBRyxXQUFXLEVBQUUsQ0FBQztBQUN6RCxRQUFBLE1BQU0sV0FBVyxHQUFHLENBQUMsZ0JBQWdCLEtBQUssTUFBTSxNQUFNLGdCQUFnQixLQUFLLEtBQUssQ0FBQyxLQUFLLGdCQUFnQixLQUFLLElBQUksQ0FBQyxDQUFDO1FBQ2pILElBQUksSUFB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Y0FBYyxFQUFFLG1DQUFtQztBQUN0RCxhQUFBO0FBQ0QsWUFBQSxJQUFJLEVBQUUsSUFBSSxlQUFlLENBQUMsSUFBSSxDQUFDO1lBQy9CLE1BQU0sRUFBRSxRQUFRLENBQUMsV0FBVztTQUMvQixDQUFDO0FBRUYsUUFBQSxJQUFJLGNBQXNCLENBQUM7QUFDM0IsUUFBQSxJQUFJOzs7QUFHQSxZQUFBLE1BQU0sWUFBWSxHQUFHLE1BQU0sS0FBSyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsVUFBVSxDQUFDLEVBQUUsV0FBVyxDQUFDLENBQUM7QUFDN0UsWUFBQSxjQUFjLEdBQUcsWUFBWSxDQUFDLEVBQUUsR0FBRyxNQUFNLFlBQVksQ0FBQyxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUM7U0FDdkU7UUFBQyxPQUFPLEVBQUUsRUFBRTtZQUNULElBQUksRUFBRSxZQUFZLFlBQVksSUFBSSxFQUFFLENBQUMsSUFBSSxLQUFLLFlBQVksRUFBRTtnQkFDeEQsT0FBTzthQUNWO1NBQ0o7Ozs7O0FBTUQsUUFBQSxJQUFJLGNBQWM7QUFDWCxlQUFBLFFBQVEsQ0FBQyxhQUFhLEtBQUssSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLO2VBQzlDLFFBQVEsQ0FBQyxjQUFjLEtBQUssSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLEVBQUU7WUFDN0QsSUFBSSxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUU7Z0JBQy9CLGNBQWMsSUFBSSxHQUFHLENBQUM7YUFDekI7QUFFRCxZQUFBLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7U0FDL0M7S0FDSjtBQUNKLENBQUE7QUFFRCxTQUFTLDBCQUEwQixDQUFDLFFBQTZCLEVBQUE7O0lBRTdELE1BQU0sY0FBYyxHQUFHLFFBQVEsQ0FBQyxZQUFZLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUN4RSxJQUFJLGNBQWMsRUFBRTtBQUNoQixRQUFBLE9BQU8sY0FBYyxDQUFDLFdBQVcsRUFBRSxLQUFLLE1BQU0sQ0FBQztLQUNsRDs7Ozs7OztBQVFELElBQUEsTUFBTSxPQUFPLEdBQUcsY0FBYyxJQUFJLE1BQU0sQ0FBQztJQUN6QyxPQUFPLENBQUMsT0FBTyxDQUFDO0FBQ3BCOztBQ25MQTtBQUNBLE1BQU0sY0FBYyxHQUFHLDZCQUE2QixDQUFDO0FBQ3JELElBQUksQ0FBQyxNQUFNLENBQUMsd0JBQXdCLENBQUMsUUFBUSxFQUFFLGNBQWMsQ0FBQyxFQUFFO0FBQzVELElBQUEsTUFBTSxDQUFDLGNBQWMsQ0FBQyxRQUFRLEVBQUUsY0FBYyxFQUFFLEVBQUUsVUFBVSxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztBQUV4RixJQUFBLGtDQUFrQyxFQUFFLENBQUM7QUFDckMsSUFBQSw4QkFBOEIsRUFBRSxDQUFDO0FBQ2pDLElBQUEsa0NBQWtDLEVBQUUsQ0FBQztBQUN6QyIsInhfZ29vZ2xlX2lnbm9yZUxpc3QiOlszXX0=
