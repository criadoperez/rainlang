import { rainlang } from "../../src/utils";
import { deployerAddress, toRange } from "../utils";
import { Diagnostic, DiagnosticSeverity, ErrorCode, getLanguageService, getOpMetaFromSg } from "../../src";
import { TextDocument } from "vscode-languageserver-textdocument";
import assert from "assert";

async function testDiagnostics(
    text: string, opmeta: Uint8Array | string, expectedDiagnostics: Diagnostic[]
) {
    const langServices = getLanguageService();
    const actualDiagnostics: Diagnostic[] = await langServices.doValidation(TextDocument.create("file", "rainlang", 1, text), opmeta);
    expectedDiagnostics.forEach((expectedDiagnostic, i) => {
        const actualDiagnostic = actualDiagnostics[i];
        assert.equal(actualDiagnostic.message, expectedDiagnostic.message);
        assert.deepEqual(actualDiagnostic.range, expectedDiagnostic.range);
        assert.equal(actualDiagnostic.severity, expectedDiagnostic.severity);
        assert.equal(actualDiagnostic.source, expectedDiagnostic.source);
    });
}
describe("Rainlang Diagnostics Service tests", async function () {
    let opMeta: string;

    before(async () => {
        opMeta = await getOpMetaFromSg(deployerAddress, "mumbai");
    });

    it("simple rainlang script", async () => {

        await testDiagnostics(rainlang`_: add(1 2)`, opMeta, [
            { message: 'source item expressions must end with semi', range: toRange(0, 0, 0, 11), severity: DiagnosticSeverity.Error, code: ErrorCode.InvalidExpression, source: 'rain' },
        ]);

        await testDiagnostics(rainlang`_: add(¢ 2)`, opMeta, [
            { message: 'found non-printable-ASCII character with unicode: "U+00a2"', range: toRange(0, 7, 0, 8), severity: DiagnosticSeverity.Error, code: ErrorCode.NonPrintableASCIICharacter, source: 'rain' },
        ]);

        await testDiagnostics("/* invalid comment  _: add(10 2);", opMeta, [
            { message: 'unexpected end of comment', range: toRange(0, 0, 0, 33), severity: DiagnosticSeverity.Error, code: ErrorCode.UnexpectedEndOfComment, source: 'rain' },
        ]);

        await testDiagnostics(rainlang`_: add(10 20) /* invalid comment */;`, opMeta, [
            { message: 'invalid RHS, comments are not allowed', range: toRange(0, 2, 0, 35), severity: DiagnosticSeverity.Error, code: ErrorCode.UnexpectedRHSComment, source: 'rain' },
        ]);

        await testDiagnostics(rainlang`123add123: add(10 20);`, opMeta, [
            { message: 'invalid LHS alias: 123add123', range: toRange(0, 0, 0, 9), severity: DiagnosticSeverity.Error, code: ErrorCode.InvalidWordPattern, source: 'rain' },
        ]);

        await testDiagnostics(rainlang`x: ();`, opMeta, [
            { message: 'parenthesis represent inputs of an opcode, but no opcode was found for this parenthesis', range: toRange(0, 3, 0, 5), severity: DiagnosticSeverity.Error, code: ErrorCode.ExpectedOpcode, source: 'rain' },
        ]);

        await testDiagnostics(rainlang`x: );`, opMeta, [
            { message: 'unexpected ")"', range: toRange(0, 3, 0, 4), severity: DiagnosticSeverity.Error, code: ErrorCode.UnexpectedClosingParen, source: 'rain' },
        ]);

        await testDiagnostics(rainlang`x: sub(add(10 20)add(1 2));`, opMeta, [
            { message: 'expected to be seperated by space', range: toRange(0, 16, 0, 18), severity: DiagnosticSeverity.Error, code: ErrorCode.ExpectedSpace, source: 'rain' },
        ]);

        await testDiagnostics(rainlang`x: add(10 20), z: ;`, opMeta, [
            { message: 'no RHS item exists to match this LHS item: z', range: toRange(0, 15, 0, 16), severity: DiagnosticSeverity.Error, code: ErrorCode.MismatchRHS, source: 'rain' },
        ]);

        await testDiagnostics(rainlang`: add(10 20);`, opMeta, [
            { message: 'no LHS item exists to match this RHS item', range: toRange(0, 2, 0, 12), severity: DiagnosticSeverity.Error, code: ErrorCode.MismatchLHS, source: 'rain' },
        ]);

        await testDiagnostics(rainlang`this-is-an-invalid-rain-expression;`, opMeta, [
            { message: 'invalid rain expression', range: toRange(0, 0, 0, 34), severity: DiagnosticSeverity.Error, code: ErrorCode.InvalidExpression, source: 'rain' },
        ]);

        await testDiagnostics(rainlang`x: read-memory<error-argument>();`, opMeta, [
            { message: 'invalid argument pattern', range: toRange(0, 15, 0, 29), severity: DiagnosticSeverity.Error, code: ErrorCode.InvalidExpression, source: 'rain' },
        ]);

        await testDiagnostics(rainlang`x: mul<10>(10 20);`, opMeta, [
            { message: 'opcode mul doesn\'t have argumented operand', range: toRange(0, 6, 0, 10), severity: DiagnosticSeverity.Error, code: ErrorCode.MismatchOperandArgs, source: 'rain' },
        ]);

        await testDiagnostics(rainlang`x: read-memory<1 2 3>(1);`, opMeta, [
            { message: 'unexpected operand argument for read-memory', range: toRange(0, 19, 0, 20), severity: DiagnosticSeverity.Error, code: ErrorCode.MismatchOperandArgs, source: 'rain' },
        ]);

        await testDiagnostics(rainlang`x: read-memory<>();`, opMeta, [
            { message: 'unexpected number of operand args for read-memory', range: toRange(0, 14, 0, 16), severity: DiagnosticSeverity.Error, code: ErrorCode.MismatchOperandArgs, source: 'rain' },
        ]);

        await testDiagnostics(rainlang`x: read-memory<0 1>(1);`, opMeta, [
            { message: 'out-of-range inputs', range: toRange(0, 19, 0, 22), severity: DiagnosticSeverity.Error, code: ErrorCode.OutOfRangeInputs, source: 'rain' },
        ]);

        await testDiagnostics(rainlang`x: read-memory<0 1>(1);`, opMeta, [
            { message: 'out-of-range inputs', range: toRange(0, 19, 0, 22), severity: DiagnosticSeverity.Error, code: ErrorCode.OutOfRangeInputs, source: 'rain' },
        ]);

        await testDiagnostics(rainlang`x: erc-20-balance-of(10 20 30);`, opMeta, [
            { message: 'out-of-range inputs', range: toRange(0, 20, 0, 30), severity: DiagnosticSeverity.Error, code: ErrorCode.OutOfRangeInputs, source: 'rain' },
        ]);

        await testDiagnostics(rainlang`_ _ _ _: do-while<1233>(1 2 3 1 3 );`, opMeta, [
            { message: 'out-of-range operand argument', range: toRange(0, 18, 0, 22), severity: DiagnosticSeverity.Error, code: ErrorCode.OutOfRangeOperandArgs, source: 'rain' },
        ]);

        await testDiagnostics(rainlang`_: add(ensure(2) add(10 20));`, opMeta, [
            { message: 'zero output opcodes cannot be nested', range: toRange(0, 7, 0, 16), severity: DiagnosticSeverity.Error, code: ErrorCode.InvalidNestedNode, source: 'rain' },
        ]);

        await testDiagnostics(rainlang`_: add(do-while<1>(1 2 3 1 3 ) add(10 20));`, opMeta, [
            { message: 'multi output opcodes cannot be nested', range: toRange(0, 7, 0, 30), severity: DiagnosticSeverity.Error, code: ErrorCode.InvalidNestedNode, source: 'rain' },
        ]);

        await testDiagnostics(rainlang`_: read-mem.ory<1 1>();`, opMeta, [
            { message: 'invalid word pattern: "read-mem.ory"', range: toRange(0, 3, 0, 15), severity: DiagnosticSeverity.Error, code: ErrorCode.InvalidWordPattern, source: 'rain' },
            { message: 'unknown opcode: "read-mem.ory"', range: toRange(0, 3, 0, 15), severity: DiagnosticSeverity.Error, code: ErrorCode.UnknownOp, source: 'rain' },
        ]);

        await testDiagnostics(rainlang`_: loop-n();`, opMeta, [
            { message: 'expected operand arguments for opcode loop-n', range: toRange(0, 3, 0, 9), severity: DiagnosticSeverity.Error, code: ErrorCode.ExpectedOperandArgs, source: 'rain' },
        ]);

        await testDiagnostics(rainlang`_ _: loop-n<1 2 2>;`, opMeta, [
            { message: 'expected "("', range: toRange(0, 5, 0, 11), severity: DiagnosticSeverity.Error, code: ErrorCode.ExpectedOpeningParen, source: 'rain' },
        ]);

        await testDiagnostics(rainlang`_ _: loop-n<1 2 2>(;`, opMeta, [
            { message: 'expected ")"', range: toRange(0, 5, 0, 19), severity: DiagnosticSeverity.Error, code: ErrorCode.ExpectedClosingParen, source: 'rain' },
        ]);

        await testDiagnostics(rainlang`addval_as: add(1 20), x: addval_as;`, opMeta, [
            { message: 'invalid pattern for alias: addval_as', range: toRange(0, 25, 0, 34), severity: DiagnosticSeverity.Error, code: ErrorCode.InvalidWordPattern, source: 'rain' },
        ]);

        await testDiagnostics(rainlang`x: add(1 20), x: x;`, opMeta, [
            { message: 'cannot reference self', range: toRange(0, 17, 0, 18), severity: DiagnosticSeverity.Error, code: ErrorCode.InvalidSelfReferenceLHS, source: 'rain' },
            { message: 'no RHS item exists to match this LHS item: x', range: toRange(0, 14, 0, 15), severity: DiagnosticSeverity.Error, code: ErrorCode.MismatchRHS, source: 'rain' },
        ]);

        await testDiagnostics(rainlang`_: add(1 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff);`, opMeta, [
            { message: 'value greater than 32 bytes in size', range: toRange(0, 9, 0, 76), severity: DiagnosticSeverity.Error, code: ErrorCode.OutOfRangeValue, source: 'rain' },
        ]);

        await testDiagnostics(rainlang`x: max-uint266;`, opMeta, [
            { message: 'undefined word: max-uint266', range: toRange(0, 3, 0, 14), severity: DiagnosticSeverity.Error, code: ErrorCode.UndefinedWord, source: 'rain' },
        ]);

        await testDiagnostics(rainlang`_: add(10 20); x: _notdefined;`, opMeta, [
            { message: '"_notdefined" is not a valid rainlang word', range: toRange(0, 18, 0, 29), severity: DiagnosticSeverity.Error, code: ErrorCode.InvalidWordPattern, source: 'rain' },
        ]);

        await testDiagnostics(rainlang`_: read-memory<1 2();`, opMeta, [
            { message: 'expected ">"', range: toRange(0, 14, 0, 20), severity: DiagnosticSeverity.Error, code: ErrorCode.ExpectedClosingOperandArgBracket, source: 'rain' },
            { message: 'expected "("', range: toRange(0, 3, 0, 14), severity: DiagnosticSeverity.Error, code: ErrorCode.ExpectedOpeningParen, source: 'rain' },
        ]);
    });

});
