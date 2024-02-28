# From @mirkokiefer's canonical-json
# https://github.com/mirkokiefer/canonical-json
"""
The original version of this code is taken from Douglas Crockford's json2.js:
https://github.com/douglascrockford/JSON-js/blob/master/json2.js
I made some modifications to ensure a canonical output.
"""
import re

def f(n):
    # Format integers to have at least two digits.
    return '0' + str(n) if n < 10 else str(n)

cx = re.compile(r'[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]')
escapable = re.compile(r'[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]')
gap = None
indent = None
meta = {    # table of character substitutions
    '\b': '\\b',
    '\t': '\\t',
    '\n': '\\n',
    '\f': '\\f',
    '\r': '\\r',
    '"' : '\\"',
    '\\': '\\\\'
}
rep = None

def quote(string):
    # If the string contains no control characters, no quote characters, and no
    # backslash characters, then we can safely slap some quotes around it.
    # Otherwise we must also replace the offending characters with safe escape
    # sequences.
    escapable.lastIndex = 0
    return '"' + string.replace(escapable, lambda a: meta[a.group()]) + '"' if escapable.search(string) else '"' + string + '"'

def str(key, holder):
    # Produce a string from holder[key].
    global gap, indent, rep
    # If the value has a toJSON method, call it to obtain a replacement value.
    value = holder[key]
    if value and isinstance(value, object) and hasattr(value, 'toJSON') and callable(value.toJSON):
        value = value.toJSON(key)
    # If we were called with a replacer function, then call the replacer to
    # obtain a replacement value.
    if callable(rep):
        value = rep(key, value)
    # What happens next depends on the value's type.
    if isinstance(value, str):
        return quote(value)
    elif isinstance(value, (int, float)):
        # JSON numbers must be finite. Encode non-finite numbers as null.
        return str(value) if isFinite(value) else 'null'
    elif isinstance(value, bool) or value is None:
        # If the value is a boolean or null, convert it to a string. Note:
        # typeof null does not produce 'null'. The case is included here in
        # the remote chance that this gets fixed someday.
        return str(value)
    elif isinstance(value, object):
        # Due to a specification blunder in ECMAScript, typeof null is 'object',
        # so watch out for that case.
        if not value:
            return 'null'
        # Make an array to hold the partial results of stringifying this object value.
        gap += indent
        partial = []
        # Is the value an array?
        if isinstance(value, list):
            # The value is an array. Stringify every element. Use null as a placeholder
            # for non-JSON values.
            length = len(value)
            for i in range(length):
                partial[i] = str(i, value) or 'null'
            # Join all of the elements together, separated with commas, and wrap them in
            # brackets.
            v = '[]' if len(partial) == 0 else ('[\n' + gap + partial.join(',\n' + gap) + '\n' + mind + ']') if gap else '[' + partial.join(',') + ']'
            gap = mind
            return v
        # If the replacer is an array, use it to select the members to be stringified.
        if rep and isinstance(rep, list):
            length = len(rep)
            for i in range(length):
                if isinstance(rep[i], str):
                    k = rep[i]
                    v = str(k, value)
                    if v:
                        partial.append(quote(k) + (gap + ': ' if gap else ':') + v)
        else:
            # Otherwise, iterate through all of the keys in the object.
            keysSorted = sorted(value.keys())
            for k in keysSorted:
                if k in value:
                    v = str(k, value)
                    if v:
                        partial.append(quote(k) + (gap + ': ' if gap else ':') + v)
        # Join all of the member texts together, separated with commas,
        # and wrap them in braces.
        v = '{}' if len(partial) == 0 else ('{\n' + gap + partial.join(',\n' + gap) + '\n' + mind + '}') if gap else '{' + partial.join(',') + '}'
        gap = mind
        return v

def stringify(value, replacer, space):
    # The stringify method takes a value and an optional replacer, and an optional
    # space parameter, and returns a JSON text. The replacer can be a function
    # that can replace values, or an array of strings that will select the keys.
    # A default replacer method can be provided. Use of the space parameter can
    # produce text that is more easily readable.
    global gap, indent, rep
    gap = ''
    indent = ''
    # If the space parameter is a number, make an indent string containing that
    # many spaces.
    if isinstance(space, int):
        indent = ' ' * space
    # If the space parameter is a string, it will be used as the indent string.
    elif isinstance(space, str):
        indent = space
    # If there is a replacer, it must be a function or an array.
    # Otherwise, throw an error.
    rep = replacer
    if replacer and not callable(replacer) and (not isinstance(replacer, list) or not isinstance(replacer, str)):
        raise ValueError('JSON.stringify')
    # Make a fake root object containing our value under the key of ''.
    # Return the result of stringifying the value.
    return str('', {'': value})


