#!/usr/bin/env node
/*
 * Dekoration
 *
 * Copyright (c) 2019 Yuichiro MORIGUCHI
 *
 * This software is released under the MIT License.
 * http://opensource.org/licenses/mit-license.php
 */
"use strict";

const parser = require("./index.js")({
    load: loadFunction
});
const readline = require("readline");
const fs = require("fs");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let PROMPT1 = " >",
    PROMPT2 = ">>";

function createCountParentheses() {
    let countBrackets = 0,
        countParentheses = 0,
        countBraces = 0,
        state = "INIT";
    return function(aString) {
        let i,
            ch;
        for(i = 0; i < aString.length; i++) {
            ch = aString.charAt(i);
            switch(state) {
            case "INIT":
                if(ch === "(") {
                    countParentheses++;
                } else if(ch === ")" && countParentheses > 0) {
                    countParentheses--;
                } else if(ch === "[") {
                    countBrackets++;
                } else if(ch === "]" && countBrackets > 0) {
                    countBrackets--;
                } else if(ch === "{") {
                    countBraces++;
                } else if(ch === "}" && countBraces > 0) {
                    countBraces--;
                } else if(ch === "\"") {
                    state = "DOUBLEQUOTE";
                }
                break;
            case "DOUBLEQUOTE":
                if(ch === "\\") {
                    state = "DQ_ESCAPE";
                } else if(ch === "\"") {
                    state = "INIT";
                }
                break;
            case "DQ_ESCAPE":
                state = "DOUBLEQUOTE";
                break;
            }
        }
        return state === "INIT" && countParentheses <= 0 && countBrackets <= 0 && countBraces <= 0;
    }
}

function removeComment(source) {
    const regex = /("(?:[^\\"]|\\[\s\S])*")|(\/\/.*(?=\r\n|\n|\r))|(\/\*[\s\S]*?\*\/)/g;
    const removed = source.replace(regex, function(match, dq, lineComment, comment) {
        if(dq) {
            return dq;
        } else if(lineComment) {
            return "";
        } else if(comment) {
            return " ";
        }
    });
    return removed;
}

function loadFunction(filename) {
    let source;
    try {
        source = removeComment(fs.readFileSync(filename, { encoding: "utf-8" }));
    } catch(e) {
        throw new Error("Cannot open file " + filename);
    }
    parser(source);
    return false;
}

function repl() {
    const countParentheses = createCountParentheses();
    let input = "";
    function execParser() {
        try {
            console.log(parser(input));
        } catch(e) {
            console.log(e.message);
        }
    }
    function next(prompt) {
        rl.question(prompt, answer => {
            if(input !== "") {
                input += "\n";
            }
            input += answer;
            if(countParentheses(answer)) {
                execParser();
                input = "";
                next(PROMPT1);
            } else {
                next(PROMPT2);
            }
        });
    }
    return next(PROMPT1);
}

function main() {
    function loadSource(filename) {
        let source;
        try {
            source = removeComment(fs.readFileSync(filename, { encoding: "utf-8" }));
        } catch(e) {
            console.error("Cannot open file " + filename);
            process.exit(2);
        }
        parser(source);
    }

    if(process.argv.length <= 2) {
        repl();
    } else if(process.argv[2] === "-l") {
        loadSource(process.argv[3]);
        repl();
    } else {
        loadSource(process.argv[2]);
        process.exit(0);
    }
}

main();
