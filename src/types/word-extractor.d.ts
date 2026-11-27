declare module "word-extractor" {
  type ExtractedDocument = {
    getBody(): string;
    getHeaders?(options?: { includeFooters?: boolean }): string;
    getFootnotes?(): string;
  };
  export default class WordExtractor {
    extract(input: string | Buffer): Promise<ExtractedDocument>;
  }
}
