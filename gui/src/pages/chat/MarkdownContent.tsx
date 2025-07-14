import Markdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import './ChatHeader.scss';


interface Props {
    content?: string,
    language?: string,
}

export function MarkdownContent({ language, content }: Props) {
    return (
        <Markdown
            remarkPlugins={[remarkGfm]}
            children={content}
            components={{
                code(props) {
                    let lang;
                    const { children, className, node, ...rest } = props

                    if (language) {
                        lang = language;
                    } else {
                        const match = /language-(\w+)/.exec(className || '')
                        if (match) {
                            lang = match[1];
                        }
                    }

                    return lang ? (
                        <SyntaxHighlighter
                            PreTag="div"
                            children={String(children).replace(/\n$/, '')}
                            language={lang}
                            style={dracula}
                        />
                    ) : (
                        <code {...rest} className={className}>
                            {children}
                        </code>
                    )
                }
            }}
        />
    );
}
