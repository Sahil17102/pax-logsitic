import sourceHtml from "../index.html?raw";

const bodyMarkup =
  sourceHtml
    .match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]
    ?.replace(/<script[^>]*src="script\.js"[^>]*><\/script>/i, "") ?? "";

export default function PaxLogisticsHome() {
  return <div dangerouslySetInnerHTML={{ __html: bodyMarkup }} />;
}
