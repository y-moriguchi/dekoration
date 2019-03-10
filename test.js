/*
 * Dekoration
 *
 * Copyright (c) 2019 Yuichiro MORIGUCHI
 *
 * This software is released under the MIT License.
 * http://opensource.org/licenses/mit-license.php
 */
"use strict";

const black   = "\u001b[30m";
const red     = "\u001b[31m";
const green   = "\u001b[32m";
const yellow  = "\u001b[33m";
const blue    = "\u001b[34m";
const magenta = "\u001b[35m";
const cyan    = "\u001b[36m";
const white   = "\u001b[37m";
const reset   = "\u001b[0m";
const defaultEpsilon = 1e-13;
let passed = 0;
let failed = 0;

function describe(mainTitle, block) {
    const parser = require("./index.js");
    const test = {
        assert: function(title, expect, code) {
            try {
                const actual = parser(code);
                if(actual === expect) {
                    console.log(`pass: ${title}`);
                    passed++;
                } else {
                    console.log(`${red}fail: ${title}: expect ${expect} but actual ${actual}${reset}`);
                    failed++;
                }
            } catch(e) {
                console.log(`${red}fail: ${title}: throw exception ${e.message}${reset}`);
                failed++;
            }
        },

        toThrow: function(title, code) {
            try {
                parser(code);
                console.log(`${red}fail: ${title}: expect throw exception${reset}`);
                failed++;
            } catch(e) {
                console.log(`pass: ${title}: ${e.message}`);
                passed++;
            }
        },

        eval: function(code) {
            parser(code);
        }
    };

    console.log(`block: ${mainTitle}`);
    block.call(test);
}

describe("operator", function() {
    this.eval("a:1");
    this.assert("simple operator", 3, "a+2");
    this.assert("operator precedence", 7, "1+2*3");
    this.assert("parenthesis", 9, "(1+2)*3");
    this.toThrow("syntax error", "1+");
});

console.log(`passed: ${passed}, failed: ${failed}`);
