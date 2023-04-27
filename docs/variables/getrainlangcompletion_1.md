[Home](../index.md) &gt; [getRainlangCompletion](./getrainlangcompletion_1.md)

# Function getRainlangCompletion()

Provides completion items

<b>Signature:</b>

```typescript
function getRainlangCompletion(document: TextDocument, position: Position, setting?: LanguageServiceParams): Promise<CompletionItem[] | null>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  document | `TextDocument` | The TextDocuemnt |
|  position | `Position` | Position of the textDocument to get the completion items for |
|  setting | [LanguageServiceParams](../interfaces/languageserviceparams.md) | (optional) Language service params |

<b>Returns:</b>

`Promise<CompletionItem[] | null>`

A promise that resolves with Completion items or null if no completion items were available for that position
