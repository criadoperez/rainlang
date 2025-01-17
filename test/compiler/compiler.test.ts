import assert from "assert";
import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { assertError, opMetaHash } from "../utils";
import { ExpressionConfig, MetaStore, rainlang, rainlangc } from "../../src";


chai.use(chaiAsPromised);
const expect: Chai.ExpectStatic = chai.expect;

describe("Rainlang Compiler (rainlangc) Tests", async function () {
    const store = new MetaStore();

    before(async () => {
        await store.updateStore(opMetaHash);
    });

    it("should fail if an invalid opmeta is specified", async () => {
        const expression = rainlang`
        /* main source */
        #exp
        _: add(1 2);`;

        const result = await rainlangc(expression, ["exp"], store)
            .catch((err) => {
                assert.equal(err[0].msg, "cannot find op meta import");
            });
        assert.equal(result, undefined, "was expecting to fail when no opmeta is specified");
    });

    it("should accept valid rainlang fragment `_:`", async () => {
        return expect(rainlangc(rainlang`@${opMetaHash} #exp _:`, ["exp"], store)).to.eventually.be.fulfilled
            .then((response: ExpressionConfig) => {
                assert.equal(response.constants.length, 0);
                assert.equal(response.sources.length, 1);
            });
    });

    it("should accept valid rainlang fragment `:`", async () => {
        return expect(rainlangc(rainlang`@${opMetaHash} #exp :`, ["exp"], store)).to.eventually.be.fulfilled
            .then((response: ExpressionConfig) => {
                assert.equal(response.constants.length, 0);
                assert.equal(response.sources.length, 1);
            });
    });

    it("should accept valid rainlang fragment `_ _:`", async () => {
        return expect(rainlangc(rainlang`@${opMetaHash} #exp _ _:`, ["exp"], store)).to.eventually.be.fulfilled
            .then((response: ExpressionConfig) => {
                assert.equal(response.constants.length, 0);
                assert.equal(response.sources.length, 1);
            });
    });

    it("should accept valid rainlang fragment `_:, _:`", async () => {
        return expect(rainlangc(
            rainlang`@${opMetaHash} #exp _:,
                    _:`, ["exp"], store)).to.eventually.be.fulfilled
            .then((response: ExpressionConfig) => {
                assert.equal(response.constants.length, 0);
                assert.equal(response.sources.length, 1);
            });
    });

    it("should accept valid rainlang fragment `_:, _:, _:, _:, _:, _:`", async () => {
        return expect(rainlangc(
            rainlang`@${opMetaHash} #exp _:, _:, _:, _:, _:, _:`, ["exp"], store)).to.eventually.be.fulfilled
            .then((response: ExpressionConfig) => {
                assert.equal(response.constants.length, 0);
                assert.equal(response.sources.length, 1);
            });
    });

    it("should accept valid rainlang fragment `/* this is a comment */ _:`", async () => {
        return expect(rainlangc(rainlang`@${opMetaHash} 
        /* this is a comment */
        #exp
        _:`, ["exp"], store)).to.eventually.be.fulfilled
            .then((response: ExpressionConfig) => {
                assert.equal(response.constants.length, 0);
                assert.equal(response.sources.length, 1);
            });
    });

    it("should accept valid rainlang fragment `#exp1 _: #exp2 _:`", async () => {
        return expect(rainlangc(rainlang`@${opMetaHash} 
        #exp1
        _:
        #exp2
        _:`, ["exp1", "exp2"], store)).to.eventually.be.fulfilled
            .then((response: ExpressionConfig) => {
                assert.equal(response.constants.length, 0);
                assert.equal(response.sources.length, 2);
            });
    });

    it("should accept valid rainlang fragment `#exp _:add(10 20)`", async () => {
        return expect(rainlangc(
            rainlang`@${opMetaHash} #exp _:add(10 20)`, 
            ["exp"], 
            store
        )).to.eventually.be.fulfilled
            .then((response: ExpressionConfig) => {
                assert.equal(response.constants.length, 2);
                assert.deepEqual(response.constants, ["10", "20"]);
                assert.equal(response.sources.length, 1);
            });
    });

    it("should accept valid rainlang fragment `_: add(10 20), _: block-timestamp()`", async () => {
        return expect(rainlangc(
            rainlang`@${opMetaHash} #exp _: add(10 20), _: block-timestamp()`, 
            ["exp"], 
            store
        )).to.eventually.be.fulfilled
            .then((response: ExpressionConfig) => {
                assert.equal(response.constants.length, 2);
                assert.deepEqual(response.constants, ["10", "20"]);
                assert.equal(response.sources.length, 1);
            });
    });

    it("should accept valid rainlang fragment `#exp _ _: add(10 20) block-timestamp()`", async () => {
        return expect(rainlangc(
            rainlang`@${opMetaHash} #exp _ _: add(10 20) block-timestamp()`, 
            ["exp"],
            store
        )).to.eventually.be.fulfilled
            .then((response: ExpressionConfig) => {
                assert.equal(response.constants.length, 2);
                assert.deepEqual(response.constants, ["10", "20"]);
                assert.equal(response.sources.length, 1);
            });
    });

    it("should accept valid rainlang fragment for multiline comment", async () => {
        return expect(rainlangc(
            rainlang`@${opMetaHash}
                #exp     
                _: block-timestamp()
            `,
            ["exp"], 
            store
        )).to.eventually.be.fulfilled
            .then((response: ExpressionConfig) => {
                assert.equal(response.constants.length, 0);
                assert.equal(response.sources.length, 1);
            });
    });

    it("should compile an expression referencing top stack items", async () => {
        const expression = rainlang`@${opMetaHash} 
            #exp
            sentinel: infinity,
            sentinel20: infinity,
            you: context<0 0>(),
            mintamount: 10,
            burnamount: 20,
            transfererc1155slist: sentinel,
            transfererc721slist: sentinel,
            transfererc20slist: sentinel,
            transfernativeslist: sentinel,
            burnslist: sentinel20,
            burn-account burn-amount: you burnamount,
            mintslist: sentinel20,
            mint-account mint-amount: you mintamount
        `;
        return expect(rainlangc(expression, ["exp"], store)).to.eventually.be.fulfilled
            .then((response: ExpressionConfig) => {
                assert.equal(response.constants.length, 3);
                assert.deepEqual(
                    response.constants, 
                    ["0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", "10", "20"]
                );
                assert.equal(response.sources.length, 1);
            });
    });

    it("should successfully compile an expression with do-while opcode having multiple outputs", async () => {
        const expression = rainlang`@${opMetaHash} 
            #exp1
            c0: 1,
            c1: 2,
            condition: 1, 
            _ _: do-while<1>(c0 c1 condition)
            
            #exp2
            s0 s1: ,
            o0 o1: 1 2,
            condition: 3
    
            #exp3
            s0: ,
            _: less-than(s0 3)

            #exp4
            s0 s1: ,
            _: add(s0 4),
            _: add(s1 5)
        `;
        return expect(rainlangc(expression, ["exp1", "exp2", "exp3", "exp4"], store)).to.eventually.be.fulfilled
            .then((response: ExpressionConfig) => {
                assert.equal(response.constants.length, 5);
                assert.deepEqual(response.constants, ["1", "2", "3", "4", "5"]);
                assert.equal(response.sources.length, 4);
            });
    });

    it("should successfully compile an expression with loop-n opcode having multiple outputs", async () => {
        const expression = rainlang`@${opMetaHash} 
            #exp1
            _ loopoutput _: loop-n<1 1 3>(
                2
                3
                4
            ),
            _ _ _ _ _ _ _ _: explode-32(loopoutput)
        
            #exp2
            s0 s1 s2: ,
            increment: add(s0 5),

            shrval: call<3 1>(increment s1 s2),
            
            lvldcr: saturating-sub(s2 1)

            #exp3
            s0 s1 s2: ,
            levelmul: mul(6 s2),
            levelexp: exp(2 levelmul),
            finalmul: mul(levelexp s0),

            op: add(finalmul s1)
        `;

        return expect(rainlangc(expression, ["exp1", "exp2", "exp3"], store)).to.eventually.be.fulfilled
            .then((response: ExpressionConfig) => {
                assert.equal(response.constants.length, 6);
                assert.deepEqual(response.constants, ["2", "3", "4", "5", "1", "6"]);
                assert.equal(response.sources.length, 3);
            });
    });

    it("should successfully compile an expression with call opcode having multiple outputs", async () => {
        const expression = rainlang`@${opMetaHash} 
            #exp
            _ _ _:  call<1 3>(2 2)
        `;
        return expect(rainlangc(expression, ["exp"], store)).to.eventually.be.fulfilled
            .then((response: ExpressionConfig) => {
                assert.equal(response.constants.length, 1);
                assert.equal(response.sources.length, 1);
            });
    });

    it("should successfully compile an expression with call opcode having multiple outputs", async () => {
        const expression = rainlang`@${opMetaHash} 
            #exp
            _ _: fold-context<2 3 1>(0 1)
        `;

        return expect(rainlangc(expression, ["exp"], store)).to.eventually.be.fulfilled
            .then((response: ExpressionConfig) => {
                assert.equal(response.constants.length, 2);
                assert.equal(response.sources.length, 1);
            });
    });

    it("should successfully compile a decompiled expression", async () => {
        const expression = rainlang`@${opMetaHash} 
        #exp1 
        _ _ _ _ _: 0x01 0x02 0x01 do-while<1>(read-memory<0 0>() read-memory<1 0>() read-memory<2 0>())

        #exp2
        _ _ _: 0x01 0x02 0x03

        #exp3
        _: less-than(read-memory<0 0>() 0x03)

        #exp4
        _ _: add(read-memory<0 0>() 0x04) add(read-memory<1 0>() 0x05)`;

        return expect(rainlangc(expression, ["exp1", "exp2", "exp3", "exp4"], store)).to.eventually.be.fulfilled
            .then((response: ExpressionConfig) => {
                assert.equal(response.constants.length, 5);
                assert.equal(response.sources.length, 4);
            });
    });

    it("should throw error for invalid rainlang fragment `#exp :add(10 20)`", async () => {
        await assertError(
            async () =>
                await rainlangc(rainlang`@${opMetaHash} #exp :add(10 20);`, ["exp"], store),
            "no LHS item exists to match this RHS item",
            "Invalid Error"
        );
    });

    it("should throw error for invalid rainlang fragment `,`", async () => {
        await assertError(
            async () =>
                await rainlangc(rainlang`@${opMetaHash} #exp ,`, ["exp"], store),
            "invalid empty expression",
            "Invalid Error"
        );
    });

    it("should throw error for invalid rainlang fragment ` `", async () => {
        await assertError(
            async () =>
                await rainlangc(rainlang`@${opMetaHash} #exp  `, ["exp"], store),
            "invalid empty expression",
            "Invalid Error"
        );
    });

    it("should throw error for invalid rainlang fragment `_`", async () => {
        await assertError(
            async () =>
                await rainlangc(rainlang`@${opMetaHash} #exp _`, ["exp"], store),
            "is not a valid rainlang word",
            "Invalid Error"
        );
    });

    it("should throw error for invalid rainlang fragment `_: add(10 20), _:`", async () => {
        await assertError(
            async () =>
                await rainlangc(rainlang`@${opMetaHash} #exp _: add(10 20), _:`, ["exp"], store),
            "no RHS item exists to match this LHS item: _",
            "Invalid Error"
        );
    });

    it("should throw error for invalid rainlang fragment `// This is an invalid comment. _: add(10, 20), _:`", async () => {

        await assertError(
            async () =>
                await rainlangc(rainlang`@${opMetaHash}
                #exp 
                // This is an invalid comment.
                _: add(10 20), _:
                `, ["exp"], store),
            "invalid LHS alias: //",
            "Invalid Error"
        );
    });

    it("should throw error for invalid rainlang fragment `_: add(10 20) block-timestamp()`", async () => {
        await assertError(
            async () =>
                await rainlangc(rainlang`@${opMetaHash} #exp _: add(10 20) block-timestamp();`, ["exp"], store),
            "no LHS item exists to match this RHS item",
            "Invalid Error"
        );
    });

    it("should not accept negative numbers", async () => {
        await assertError(
            async () =>
                await rainlangc(rainlang`@${opMetaHash} #exp _: add(-10 20);`, ["exp"], store),
            "is not a valid rainlang word",
            "Invalid Error"
        );

        await assertError(
            async () =>
                await rainlangc(rainlang`@${opMetaHash} #exp _: sub(123941 -123941);`, ["exp"], store),
            "is not a valid rainlang word",
            "Invalid Error"
        );
    });

    it("should only accept ASCII characters", async () => {
        await assertError(
            async () => await rainlangc(rainlang`@${opMetaHash} #exp _: add(10𐐀 20);`, ["exp"], store),
            "illegal character: \\\"𐐀\\\"",
            "Invalid Error"
        );
    });

    it("should error if invalid operand brackets is provided", async () => {
        await assertError(
            async () => await rainlangc(rainlang`@${opMetaHash} #exp _: read-memory<10 1();`, ["exp"], store),
            "expected \\\">\\\"",
            "Invalid Error"
        );
    });

    it("should error if invalid parenthesis is provided", async () => {
        await assertError(
            async () => await rainlangc(rainlang`@${opMetaHash} #exp _: read-memory<10 1>;`, ["exp"], store),
            "expected \\\"(\\\"",
            "Invalid Error"
        );
        await assertError(
            async () => await rainlangc(rainlang`@${opMetaHash} #exp _: read-memory<10 1>(;`, ["exp"], store),
            "expected \\\")\\\"",
            "Invalid Error"
        );
    });

    it("should error if invalid word pattern is provided", async () => {
        await assertError(
            async () => await rainlangc(rainlang`@${opMetaHash} #exp _: <10 1>();`, ["exp"], store),
            "is not a valid rainlang word",
            "Invalid Error"
        );
    });

    it("should error if invalid opcode is passed in the rainlang fragment", async () => {
        await assertError(
            async () => await rainlangc(rainlang`@${opMetaHash} #exp _: readmemory<10 1>();`, ["exp"], store),
            "unknown",
            "Invalid Error"
        );
    });

    it("should error if operand arguments are missing in the rainlang fragment", async () => {
        await assertError(
            async () => await rainlangc(rainlang`@${opMetaHash} #exp _: read-memory();`, ["exp"], store),
            "771",
            "Invalid Error"
        );

        await assertError(
            async () => await rainlangc(rainlang`@${opMetaHash} #exp _: read-memory<>();`, ["exp"], store),
            "1027",
            "Invalid Error"
        );

        await assertError(
            async () => await rainlangc(rainlang`@${opMetaHash} #exp _: read-memory<1>();`, ["exp"], store),
            "1027",
            "Invalid Error"
        );
    });

    it("should error if out-of-range operand arguments is provided", async () => {
        await assertError(
            async () => await rainlangc(rainlang`@${opMetaHash} #exp _: read-memory<1 2>();`, ["exp"], store),
            "1282",
            "Invalid Error"
        );
    });

    it("should error if a word is undefined", async () => {
        await assertError(
            async () => await rainlangc(rainlang`@${opMetaHash} #exp _: add(ans 1);`, ["exp"], store),
            "undefined word: ans",
            "Invalid Error"
        );

    });
});