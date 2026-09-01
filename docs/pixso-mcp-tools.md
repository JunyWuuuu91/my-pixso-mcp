# Pixso 官方本地 MCP 工具清单（实测）

来源：`tools/list` 实际响应（Pixso 桌面客户端 2.3.1，`http://127.0.0.1:3667/mcp`），共 37 个工具。用 `node scripts/probe-mcp.mjs tools` 可重新生成。

## 发现与结构

| 工具 | 作用 | 入参 |
|---|---|---|
| `get_top_level_frames` | Get page or top-level frame information in the current Pixso file. | type, pageIds, includeHidden |
| `query_nodes` | Retrieve nodes by searching for matching patterns and by node ids in batches. - IMPORTANT: Combine multiple search patterns and node ID searches into one call. - IMPORTANT: When you want to perform mu | filePath, nodeIds, patterns, parentId, readDepth, searchDepth, resolveInstances, resolveVariables, includePathGeometry, fields |
| `get_node_dsl` | Generate the DSL of the node for a given node or the currently selected node in the Pixso desktop app. | guid, clientFrameworks, simplify, isDetachInstance |
| `get_variants` | Generate the variants of the node for a given node or the currently selected node in the Pixso desktop app. | guid |
| `read_component_config_data` | Read design-side data for generating component parser config. |  |
| `fetch_context` | Get the current active canvas editor, current user selection, and other basic design information (components, variables, styles) to start the design task. | include_schema, include_map |

## 设计令牌（变量 / 样式 / 组件）

| 工具 | 作用 | 入参 |
|---|---|---|
| `get_variable_sets` | Get all variable sets |  |
| `get_variables` | Get variables by compact DSL variable IDs or by variable set ID. | variableSetId, variableIds |
| `read_variables` | Read design variables and variable sets. | assetIds |
| `get_local_styles` | Get local styles. | styleIds |
| `get_remote_styles` | Get remote styles. | styleIds |
| `read_styles` | Read shared styles. | assetIds |
| `list_style_tags` | Returns all available style guide tags. |  |
| `get_style_guide` | Returns a style guide for design inspiration based on a set of tags. | tags |
| `get_all_components` | Get all components |  |
| `read_components` | Read reusable components and component sets. | assetIds |

## 视觉与导出

| 工具 | 作用 | 入参 |
|---|---|---|
| `get_screenshot` | Generate a screenshot (PNG preview) for a single given node or the currently selected node in the Pixso desktop app. | guid, clientFrameworks |
| `take_screenshot` | Returns screenshots of one or more nodes for final visual design verification. | nodeId, nodeIds |
| `get_export_image` | Export a design node as an image file (PNG, JPEG, SVG, PDF, etc.) from the Pixso desktop app. | guid, exportSettings |

## 代码生成

| 工具 | 作用 | 入参 |
|---|---|---|
| `design_to_code` | Generate UI code for one or more given nodes, or the currently selected node(s), in the Pixso desktop app. | guids, clientFrameworks |
| `refine_generated_code` | Refine and optimize generated code using selected tags: responsive layout, CSS variables, Tailwind, DRY extraction, or project design-system alignment. | refinementTags |

## 写回设计稿

| 工具 | 作用 | 入参 |
|---|---|---|
| `apply_design` | Execute multiple insert/copy/update/replace/move/delete/image operations in a single call. | operations |
| `code_to_design` | Convert an HTML string or a ZIP archive (containing HTML/CSS/assets) into a Pixso design node and paste it onto the current canvas. | htmlStr, htmlBuffer, htmlBufferBase64 |
| `create_instance` | Create an instance based on the component key | componentKey |
| `set_bound_variables` | Bind variables to the node or text attributes. | bindings |
| `set_fill_style` | Set the fill style of the node. | guid, styleKey |
| `set_stroke_style` | Set the stroke style of the node. | guid, styleKey |
| `set_text_style` | Set the text style of the text node. | guid, styleKey |
| `set_grid_style` | Set the grid style of the node. | guid, styleKey |
| `write_variables` | Create, update, rename, or delete local variable sets or local variables in the current document. | variableSets, variables |
| `write_styles` | Create, update, rename, or delete shared styles in the current document. | styles |
| `replace_props` | Recursively replace all matching properties on the node tree for provided parent ids. | parentIds, properties |

## 体检与兜底

| 工具 | 作用 | 入参 |
|---|---|---|
| `check_layout` | Check the current layout structure of an pixso file. | parentId, maxDepth, problemsOnly |
| `query_all_unique_props` | Recursively search for all unique properties on the node tree for provided parent ids. | parents, properties |
| `read_comments` | Read comment threads from the current Pixso file for summarization, thematic organization, action-item extraction, or comment-driven design changes. | scope, status, nodeIds, includeReplies, offset, limit |
| `eval_script` | Execute JavaScript in the current Pixso file through the Pixso Plugin API. | script |
| `load_guidelines` | Returns design guidelines and rules for working with .pixso files. | topic |
