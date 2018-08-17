import RRule from '../rrule';
import RRuleSet from '../rruleset';
import dateutil from '../dateutil';
import { includes, split } from '../helpers';
import { handlers, handle_DTSTART, handle_TZID } from './handlers';
/**
 * RRuleStr
 *  To parse a set of rrule strings
 */
var DEFAULT_OPTIONS = {
    dtstart: null,
    cache: false,
    unfold: false,
    forceset: false,
    compatible: false,
    tzid: null
};
function _parseRfcRRule(line, options) {
    if (options === void 0) { options = {}; }
    options.dtstart = options.dtstart || null;
    options.cache = options.cache || false;
    var name;
    var value;
    var parts;
    var nameRegex = /^([A-Z]+):(.*)$/;
    var nameParts = nameRegex.exec(line);
    if (nameParts && nameParts.length >= 3) {
        name = nameParts[1];
        value = nameParts[2];
        if (name !== 'RRULE')
            throw new Error("unknown parameter name " + name);
    }
    else {
        value = line;
    }
    var rrkwargs = {};
    var dtstart = /DTSTART(?:;TZID=[^:]+:)?[^;]+/.exec(line);
    if (dtstart && dtstart.length > 0) {
        var dtstartClause = dtstart[0];
        handle_DTSTART(rrkwargs, 'DTSTART', dtstartClause);
        handle_TZID(rrkwargs, 'TZID', dtstartClause);
    }
    var pairs = value.split(';');
    for (var i = 0; i < pairs.length; i++) {
        parts = pairs[i].split('=');
        name = parts[0].toUpperCase();
        if (/DTSTART|TZID/.test(name)) {
            continue;
        }
        value = parts[1].toUpperCase();
        var paramHandler = handlers[name];
        if (typeof paramHandler !== 'function') {
            throw new Error("unknown parameter '" + name + "':" + value);
        }
        paramHandler(rrkwargs, name, value);
    }
    rrkwargs.dtstart = rrkwargs.dtstart || options.dtstart;
    rrkwargs.tzid = rrkwargs.tzid || options.tzid;
    return new RRule(rrkwargs, !options.cache);
}
function _parseRfc(s, options) {
    if (options.compatible) {
        options.forceset = true;
        options.unfold = true;
    }
    s = s && s.trim();
    if (!s)
        throw new Error('Invalid empty string');
    var i = 0;
    var line;
    var lines;
    // More info about 'unfold' option
    // Go head to http://www.ietf.org/rfc/rfc2445.txt
    if (options.unfold) {
        lines = s.split('\n');
        while (i < lines.length) {
            // TODO
            line = lines[i] = lines[i].replace(/\s+$/g, '');
            if (!line) {
                lines.splice(i, 1);
            }
            else if (i > 0 && line[0] === ' ') {
                lines[i - 1] += line.slice(1);
                lines.splice(i, 1);
            }
            else {
                i += 1;
            }
        }
    }
    else {
        lines = s.split(/\s/);
    }
    if (!options.forceset &&
        lines.length === 1 &&
        (s.indexOf(':') === -1 || s.indexOf('RRULE:') === 0)) {
        return _parseRfcRRule(lines[0], {
            cache: options.cache,
            dtstart: options.dtstart
        });
    }
    var rrulevals = [];
    var rdatevals = [];
    var exrulevals = [];
    var exdatevals = [];
    var name;
    var value;
    var parts;
    var dtstart;
    var tzid;
    var rset;
    var j;
    var k;
    var datestrs;
    var datestr;
    for (var i_1 = 0; i_1 < lines.length; i_1++) {
        line = lines[i_1];
        if (!line)
            continue;
        if (line.indexOf(':') === -1) {
            name = 'RRULE';
            value = line;
        }
        else {
            parts = split(line, ':', 1);
            name = parts[0];
            value = parts[1];
        }
        var parms = name.split(';');
        if (!parms)
            throw new Error('empty property name');
        name = parms[0].toUpperCase();
        parms = parms.slice(1);
        if (name === 'RRULE') {
            for (j = 0; j < parms.length; j++) {
                var parm = parms[j];
                throw new Error('unsupported RRULE parm: ' + parm);
            }
            rrulevals.push(value);
        }
        else if (name === 'RDATE') {
            for (j = 0; j < parms.length; j++) {
                var parm = parms[j];
                if (parm !== 'VALUE=DATE-TIME' && parm !== 'VALUE=DATE') {
                    throw new Error('unsupported RDATE parm: ' + parm);
                }
            }
            rdatevals.push(value);
        }
        else if (name === 'EXRULE') {
            for (j = 0; j < parms.length; j++) {
                var parm = parms[j];
                throw new Error('unsupported EXRULE parm: ' + parm);
            }
            exrulevals.push(value);
        }
        else if (name === 'EXDATE') {
            for (j = 0; j < parms.length; j++) {
                var parm = parms[j];
                if (parm !== 'VALUE=DATE-TIME' && parm !== 'VALUE=DATE') {
                    throw new Error('unsupported EXDATE parm: ' + parm);
                }
            }
            exdatevals.push(value);
        }
        else if (name === 'DTSTART') {
            dtstart = dateutil.untilStringToDate(value);
            if (parms.length) {
                var _a = parms[0].split('='), key = _a[0], value_1 = _a[1];
                if (key === 'TZID') {
                    tzid = value_1;
                }
            }
        }
        else {
            throw new Error('unsupported property: ' + name);
        }
    }
    if (options.forceset ||
        rrulevals.length > 1 ||
        rdatevals.length ||
        exrulevals.length ||
        exdatevals.length) {
        rset = new RRuleSet(!options.cache);
        for (j = 0; j < rrulevals.length; j++) {
            rset.rrule(_parseRfcRRule(rrulevals[j], {
                // @ts-ignore
                dtstart: options.dtstart || dtstart
            }));
        }
        for (j = 0; j < rdatevals.length; j++) {
            datestrs = rdatevals[j].split(',');
            for (k = 0; k < datestrs.length; k++) {
                datestr = datestrs[k];
                rset.rdate(dateutil.untilStringToDate(datestr));
            }
        }
        for (j = 0; j < exrulevals.length; j++) {
            rset.exrule(_parseRfcRRule(exrulevals[j], {
                // @ts-ignore
                dtstart: options.dtstart || dtstart
            }));
        }
        for (j = 0; j < exdatevals.length; j++) {
            datestrs = exdatevals[j].split(',');
            for (k = 0; k < datestrs.length; k++) {
                datestr = datestrs[k];
                rset.exdate(dateutil.untilStringToDate(datestr));
            }
        }
        // @ts-ignore
        if (options.compatible && options.dtstart)
            rset.rdate(dtstart);
        return rset;
    }
    return _parseRfcRRule(rrulevals[0], {
        // @ts-ignore
        dtstart: options.dtstart || dtstart,
        cache: options.cache,
        // @ts-ignore
        tzid: options.tzid || tzid
    });
}
export function rrulestr(s, options) {
    if (options === void 0) { options = {}; }
    var invalid = [];
    var keys = Object.keys(options);
    var defaultKeys = Object.keys(DEFAULT_OPTIONS);
    keys.forEach(function (key) {
        if (!includes(defaultKeys, key))
            invalid.push(key);
    });
    if (invalid.length) {
        throw new Error('Invalid options: ' + invalid.join(', '));
    }
    // Merge in default options
    defaultKeys.forEach(function (key) {
        if (!includes(keys, key))
            options[key] = DEFAULT_OPTIONS[key];
    });
    return _parseRfc(s, options);
}
//# sourceMappingURL=index.js.map