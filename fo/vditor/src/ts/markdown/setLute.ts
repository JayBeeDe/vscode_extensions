import {keepWhatLuteDrops} from "./luteRoundTrip";
import {keepTableCellSpaces} from "./tableCellSpace";

export const setLute = (options: ILuteOptions) => {
    const lute: Lute = Lute.New();
    lute.SetHeadingAnchor(options.headingAnchor);
    lute.SetInlineMathAllowDigitAfterOpenMarker(options.inlineMathDigit);
    lute.SetAutoSpace(options.autoSpace);
    lute.SetToC(options.toc);
    lute.SetFootnotes(options.footnotes);
    lute.SetFixTermTypo(options.fixTermTypo);
    lute.SetVditorCodeBlockPreview(options.codeBlockPreview);
    lute.SetVditorMathBlockPreview(options.mathBlockPreview);
    lute.SetSanitize(options.sanitize);
    lute.SetChineseParagraphBeginningSpace(options.paragraphBeginningSpace);
    lute.SetRenderListStyle(options.listStyle);
    lute.SetLinkBase(options.linkBase);
    lute.SetLinkPrefix(options.linkPrefix);
    lute.SetMark(options.mark);
    // an emoji shortcode (`:rocket:`) is text, shown and saved as written (as in Obsidian): read as
    // an emoji, it was saved as one in WYSIWYG mode
    lute.SetEmoji(false);
    if (options.obsidian) {
        lute.SetObsidian(true);
    } else {
        lute.SetCallout(options.callout ?? false);
        lute.SetObsidianWikiLink(options.obsidianWikiLink ?? false);
        lute.SetObsidianTag(options.obsidianTag ?? false);
    }
    if (options.lazyLoadImage) {
        lute.SetImageLazyLoading(options.lazyLoadImage);
    }
    return keepTableCellSpaces(keepWhatLuteDrops(lute));
};
