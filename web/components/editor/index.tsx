import "prosemirror-view/style/prosemirror.css";

import { baseKeymap, Command, toggleMark } from "prosemirror-commands";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { DOMParser, DOMSerializer, MarkType } from "prosemirror-model";
import { schema } from "prosemirror-schema-basic";
import { EditorState, Transaction } from "prosemirror-state";
import React, { Ref } from "react";
import TurndownService from "turndown";
import { ProseMirror, useProseMirror } from "use-prosemirror";

import CodeDiffView from "../../classes/prosemirror/code-diff-view";
import { IPullRequest } from "../../interfaces/pull-request.interface";
import { IPullRequestDiff } from "../../interfaces/pull-request-diff.interface";
import { NodeViews } from "./prosemirror.types";

const toggleBold = toggleMarkCommand(schema.marks.strong);
const toggleItalic = toggleMarkCommand(schema.marks.em);

const nodeViews: NodeViews = {
  codeDiff: CodeDiffView.create,
};

function prepareForParsing(content: string): Node {
  const domNode = document.createElement("div");
  domNode.innerText = content;

  return domNode;
}

type Props = {
  initialContent: string;
  pullRequest?: IPullRequest;
  diffs?: IPullRequestDiff[];
  onChange: (mdx: string) => void;
};

const Editor: React.FC<Props> = ({
  initialContent,
  pullRequest,
  diffs,
  onChange,
}) => {
  const opts: Parameters<typeof useProseMirror>[0] = {
    schema,
    doc: DOMParser.fromSchema(schema).parse(prepareForParsing(initialContent)),
    plugins: [
      history(),
      keymap({
        ...baseKeymap,
        "Mod-z": undo,
        "Mod-y": redo,
        "Mod-Shift-z": redo,
        "Mod-b": toggleBold,
        "Mod-i": toggleItalic,
      }),
    ],
  };

  const [state, setState] = useProseMirror(opts);

  function handleChange(state: EditorState) {
    const fragment = DOMSerializer.fromSchema(schema).serializeFragment(
      state.doc?.content
    );
    const tmp = document.createElement("div");
    tmp.appendChild(fragment);

    const turndownService = new TurndownService();
    const markdown: string = turndownService.turndown(tmp.innerHTML);
    if (pullRequest && diffs) {
      const textWithFullComponent = markdown.replace(
        /<PullRequestDiff\s+path="\S+"\s*\/>/gm,
        (originalText) => {
          const whiteSpaceDelimited = originalText.split(/\s/);
          const [_, ...withoutOpeningTag] = whiteSpaceDelimited;
          const path = /path="(?<path>[^"]+)"/g.exec(originalText)?.groups
            ?.path;
          if (!path) return "";
          const diff = diffs.find((diff) => diff.path === path);
          if (!diff) return "";
          return `<PullRequestDiff repositoryOwner="${
            pullRequest.repositoryOwner
          }" repositoryName="${
            pullRequest.repositoryName
          }" pullRequestNumber="${
            pullRequest.pullRequestNumber
          }" oldFileRefOid="${diff.oldFileRefOid}" newFileRefOid="${
            diff.newFileRefOid
          }" numDiffLines="${diff.numDiffLines}" ${withoutOpeningTag.join(
            " "
          )}`;
        }
      );
      onChange(textWithFullComponent);
    }
    setState(state);
  }

  return (
    <div>
      {/*<div>
        <Button
          className="bold"
          isActive={isBold(state)}
          onClick={() => toggleBold(state, (tr) => setState(state.apply(tr)))}
        >
          B
        </Button>
        <Button
          className="italic"
          isActive={isItalic(state)}
          onClick={() => toggleItalic(state, (tr) => setState(state.apply(tr)))}
        >
          I
        </Button>
      </div>*/}
      <ProseMirror
        className="ProseMirror"
        state={state}
        onChange={handleChange}
        nodeViews={nodeViews}
      />
    </div>
  );
};

function toggleMarkCommand(mark: MarkType): Command {
  return (
    state: EditorState,
    dispatch: ((tr: Transaction) => void) | undefined
  ) => toggleMark(mark)(state, dispatch);
}

function isBold(state: EditorState): boolean {
  return isMarkActive(state, schema.marks.strong);
}

function isItalic(state: EditorState): boolean {
  return isMarkActive(state, schema.marks.em);
}

// https://github.com/ProseMirror/prosemirror-example-setup/blob/afbc42a68803a57af3f29dd93c3c522c30ea3ed6/src/menu.js#L57-L61
function isMarkActive(state: EditorState, mark: MarkType): boolean {
  const { from, $from, to, empty } = state.selection;
  return empty
    ? !!mark.isInSet(state.storedMarks || $from.marks())
    : state.doc.rangeHasMark(from, to, mark);
}

function Button(props: {
  children: React.ReactNode;
  isActive: boolean;
  className: string;
  onClick: () => void;
}) {
  return (
    <button
      className={props.className}
      style={{
        backgroundColor: props.isActive ? "#efeeef" : "#fff",
        color: props.isActive ? "blue" : "black",
      }}
      onMouseDown={handleMouseDown}
    >
      {props.children}
    </button>
  );

  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault(); // Prevent editor losing focus
    props.onClick();
  }
}

export default Editor;
