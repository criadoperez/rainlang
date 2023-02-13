import { BytesLike, BigNumber, ethers } from 'ethers';
import { StateConfig, OpMeta, InputMeta, OutputMeta, OperandArgs } from '../../types';
import { arrayify, extractByBits, isBigNumberish, metaFromBytes, validateMeta } from '../../utils';
import { Config, PrettifyConfig } from './types';
import OpMetaSchema from "../../schema/op.meta.schema.json";
import { Equation, Expression, parse } from 'algebra.js';


/**
 * @public
 * The generator of human friendly readable source.
 *
 * @remarks
 * Parse an StateConfig/Script to a more human readable form, making easier to understand. This form allows users read exactly
 * what the Script will do, like the conditions, values used, etc. Also, anyone can learn to write their own scripts
 * if use the Human Form to see the output for each combination that they made.
 */
export class Formatter {
    private static opmeta: OpMeta[]

    /**
     * @public
     * Method to set the opmeta with more than AllStandardOps opcodes or with other name/aliases for this instance of the Formatter
     *
     * @param opmeta - Ops meta as bytes ie hex string or Uint8Array or json content as string or array of object (json parsed)
     */
    public static set(opmeta: string | Uint8Array | object[]) {
        if (isBigNumberish(opmeta)) {
            this.opmeta = metaFromBytes(opmeta as BytesLike, OpMetaSchema) as OpMeta[]
        }
        else {
            const _meta = typeof opmeta === "string" ? JSON.parse(opmeta) : opmeta
            if (validateMeta(_meta, OpMetaSchema)) this.opmeta = _meta as OpMeta[]
            else throw new Error("invalid op meta")
        }
    }

    /**
     * @public
     * Obtain the friendly output from an StateConfig/script.
     * 
     * @param _state - The StateConfig/script to generate the friendly version
     * @param _opmeta - Ops meta as bytes ie hex string or Uint8Array or json content as string or array of object (json parsed)
     * @param _config - The configuration that will run the generator
     * @returns
     */
    public static get(
        _state: StateConfig,
        _opmeta: string | Uint8Array | object[],
        _config: Config = {
            pretty: false,
            // tags: undefined,
            // enableTagging: false,
        }
    ): string {
        this.set(_opmeta)
        const _constants: string[] = []
        for (const item of _state.constants) {
            _constants.push(BigNumber.from(item).toHexString())
        }
        const _result = this._format(
            _state.sources,
            _constants,
            // _config.tags,
            // _config.enableTagging
        )
        return _config.pretty ? this.prettify(_result) : _result
    }

    /**
     * @public
     * Make the output from the HumanFriendly Source more readable by adding indenting following the parenthesis
     *
     * @remarks
     * If the string is already indentend, the method will wrongly generate the string
     *
     * @param _text - The output from the HumanFriendlySource
     * @param _config - The configuration of the prettify method (experimental)
     * @returns A prettified output
     */
    public static prettify(_text: string, _config: PrettifyConfig = {}): string {
        let { n } = _config
        if (!n) n = 2
        // if (!length) length = 20
        const space = ' '
        let counter = 0
        const _expressions: string[] = []

        // extract individual expression (sources expressions) that are seperated by semi
        while (_text.length) {
            const _index = _text.search(/;/i)
            if (_index > -1) {
                _expressions.push(_text.slice(0, _index + 1))
                _text = _text.slice(_index + 1)
            } 
        }

        // start prettifying
        for (let j = 0; j < _expressions.length; j++) {
            const _lhsIndex = _expressions[j].search(/:/i)
            for (let i = _lhsIndex + 2; i < _expressions[j].length; i++) {
                if ( _expressions[j][i] === ' ' && counter > 0) {
                    _expressions[j] =
                        _expressions[j].slice(0, i + 1) +
                        '\n' +
                        space.repeat(counter * n) +
                        _expressions[j].slice(i + 1)
                    i += (counter * n) + 2
                }
                if (_expressions[j][i] === '(') {
                    counter++
                    _expressions[j] =
                        _expressions[j].slice(0, i + 1) +
                        '\n' +
                        space.repeat(counter * n) +
                        _expressions[j].slice(i + 1)
                    i += (counter * n) + 2
                }
                if (_expressions[j][i] === ')') {
                    counter--
                    _expressions[j] =
                        _expressions[j].slice(0, i) +
                        '\n' +
                        space.repeat(counter * n) +
                        _expressions[j].slice(i)
                    i += (counter * n) + 1
                }
            }
        }
        return _expressions.join('\n')
    }

    // * @param tags - (optional) Tags/names/aliases for individual items in final results (should be passed in order)
    // * @param enableTagging - True if the result needs to be tagged and optimized for the RuleBuilder script generator

    /**
     * The main workhorse of the Human Friendly Readable source that builds the whole text
     *
     * @param sources - The StateConfig sources
     * @param constants - The StateConfig constants all in hex string format
     * @returns A human friendly readable text of the passed script
     */
    private static _format = (
        sources: BytesLike[],
        constants: string[],
        // tags?: string[],
        // enableTagging = false,
    ): string => {
        let _stack: string[] = []
        const _finalStack: string[] = []
        //const useableTags = tags
        //let counter = 0

        // start formatting
        for (let i = 0; i < sources.length; i++) {
            const lhs: string[] = []
            const src = arrayify(sources[i], { allowMissingPrefix: true })
            let zeroOpCounter = 0
            for (let j = 0; j < src.length; j += 4) {
                const _op = (src[j] << 8) + src[j + 1]
                const _operand = (src[j + 2] << 8) + src[j + 3]
                const _index = _op

                // error if an opcode not found in opmeta
                if (_index > this.opmeta.length) throw new Error(
                    `opcode with enum "${_op}" does not exist on OpMeta`
                )
                else {
                    if (_op === this.opmeta.findIndex(v => v.name === "read-memory") && (_operand & 1) === 1) {
                        _stack.push(
                            BigNumber.from(constants[_operand >> 1]).eq(ethers.constants.MaxUint256)
                                ? 'max-uint256'
                                : constants[_operand >> 1]
                        )
                    }
                    else {
                        let operandArgs = ''
                        const _multiOutputs: string[] = []
                        const inputs = this._calcInputs(this.opmeta[_index].inputs, _operand)
                        const outputs = this._calcOutputs(this.opmeta[_index].outputs, _operand)

                        // count zero output ops
                        if (outputs === 0) zeroOpCounter++

                        // construct operand arguments
                        if (typeof this.opmeta[_index].operand !== "number") {
                            let args
                            try {
                                args = this._deconstructByBits(
                                    _operand, 
                                    (this.opmeta[_index].operand as OperandArgs).map((v) => {
                                        return {
                                            bits: v.bits,
                                            computation: v.computation
                                        }
                                    })
                                )
                            }
                            catch (err) {
                                throw new Error(`${err} of opcode ${this.opmeta[_index].name}`)
                            }   
                            if (
                                args.length === (this.opmeta[_index].operand as OperandArgs).length
                            ) {
                                const _i = (this.opmeta[_index].operand as OperandArgs).findIndex(
                                    v => v.name === "inputs"
                                )
                                if (_i > -1) args.splice(_i, 1)
                                if (args.length) operandArgs = '<' + args.join(" ") + ">"
                            }
                            else throw new Error(
                                `decoder of opcode with enum "${
                                    this.opmeta[_index].name
                                }" does not match with its operand arguments`
                            )
                        }

                        // cache multi outputs to use when updating the formatter stack
                        if (outputs > 1) {
                            for (let k = 0; k < outputs - 1; k++) _multiOutputs.push('_')
                        }

                        // update formatter stack with new formatted opcode i.e.
                        // take some items based on the formatted opcode and then
                        // push the appended string with the opcode back into the stack
                        _stack.push(
                            ..._multiOutputs,
                            this.opmeta[_index].name +
                            operandArgs +
                            '(' +
                            (inputs > 0 ? _stack.splice(-inputs).join(' ') : '') +
                            ')'
                        )
                    }
                }
            }

            // handle sources taggings if enabled by caller
            // if (enableTagging) {
            //     for (let j = 0; j < _stack.length; j++) {
            //         const tempTag = useableTags?.shift()
            //         _stack[j] = tempTag
            //             ? `${tempTag}: {${_stack[j]}}`
            //             : `Item${counter}: {${_stack[j]}}`

            //         counter++
            //     }
            // }

            // cache the LHS elements
            for (let j = 0; j < _stack.length - zeroOpCounter; j++) lhs.push('_')

            // construct the source expression at current index, both LHS and RHS
            _finalStack.push(
                lhs.join(' ').concat(': ') + 
                _stack.join(' ').concat(';')
            )
            _stack = []
        }

        // join all sources expressions by seperating them 
        // by new line and return the result
        return _finalStack.join('\n')
    }

    /**
     * Method to calculate number of inputs
     */
    private static _calcInputs(inputMeta: InputMeta, operand: number): number {
        if (inputMeta === 0) return 0
        else {
            if ("bits" in inputMeta) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                return extractByBits(operand, inputMeta.bits!, inputMeta.computation)
            }
            else return inputMeta.parameters.length
        }
    }

    /**
     * Method to calculate number of outputs
     */
    private static _calcOutputs(outputMeta: OutputMeta, operand: number): number {
        if (typeof outputMeta === "number") return outputMeta
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            return extractByBits(operand, outputMeta.bits!, outputMeta.computation)
        }
    }

    /**
     * Method deconstruct operand to seperated arguments
     */
    private static _deconstructByBits(value: number, args: {
        bits: [number, number], 
        computation?: string
    }[]): number[] {
        const result = []
        for (let i = 0; i < args.length; i++) {
            let _val = extractByBits(value, args[i].bits)
            const _comp = args[i].computation
            if (_comp) {
                const _lhs = parse(_comp)
                const _eq = new Equation(_lhs as Expression, _val)
                const _res = _eq.solveFor("arg")?.toString()
                if (_res !== undefined) _val = Number(_res)
                else throw new Error("invalid/corrupt operand or operand arguments in opmeta")
            }
            result.push(_val)
        }
        return result
    }
}
