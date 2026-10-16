# Granular journeys: screen → interaction → system work → UI result

Use this when discovering, authoring, visualising or reviewing a flow or journey (`<workspace>/flows/`,
`journeys/`, or ops in a plan) that touches a UI, email, notification or document. A stage is an overview; it must not replace the individual
interactions and backend steps that explain how the experience works.

## Capture the interaction, not just the screens

For each meaningful interaction, establish these facts from code, designs or the owner:

| Part             | What to record with existing fields                                                                                                                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Starting context | The actual page, modal or tool and its relevant state in `screens`, `regions[].shows` and the step's `screen` reference.                                                                                                                             |
| User action      | One specific action in `steps[].action`, linked to the control with `screen: scr:page#region`; the UI service is `from`, never the person.                                                                                                           |
| System work      | Each relevant call, internal data change, publish and consumer step with `from`, `to`, `via`, `logic`, `reads`/`writes` and `fails` as applicable. The handlers behind each step (`handlers.yaml`) hold the full logic; the flow step names the hop. |
| Visible result   | A separate step for the UI update or output, linked to its actual screen/region; describe the result and when it becomes visible.                                                                                                                    |
| Alternatives     | Conditions, failures, retries and asynchronous work in the relevant steps; record missing evidence as an open question.                                                                                                                              |

Split on distinct user actions, service/interface handoffs, meaningful data changes and visible
results. Do not combine choosing a method, submitting, authorising and showing confirmation into
one opaque step. Do not split every implementation statement: retain the granularity needed to
explain behaviour and ownership. Never merge unrelated actions to meet a fixed stop count.
An authored `beat` can name related work; it must not conceal independently explorable steps.
Repeated interactions on one screen remain distinct; one screen is not one journey step.

**Alignment example:** Product page / Add to cart button → Storefront sends the add-line request
→ Cart stores the line → Storefront shows the cart. The action starts on the product page, not
the cart. Keep the product-page context while inspecting the associated backend work; switch to
the cart when the flow actually shows it. Apply the same check to address submission, payment,
admin edits, mobile actions and generated outputs.

## Evidence and timing

- `screen:` identifies linked UI context, not proof of a click, current rendered state or causality.
  A region link alone does not prove interaction either. Distinguish a user action, page request,
  screen update, document creation and delivery from their actual behaviour.
- A populated product page at an initial fetch is a screen reference, not evidence that the fetch
  already completed. Capture loading/error states when relevant and supported; otherwise label
  the reference and state the gap. Never substitute the future result for the starting UI.
- A PDF being rendered has not necessarily been attached or delivered. An event consumer is not
  guaranteed to complete synchronously with a button press. Preserve those steps separately.
- Consecutive steps or a shared screen do not prove that one interaction triggered all of them.
  Keep independent event consumers and later manual actions distinguishable. If grouping is
  inferred from recorded order, label it as inferred and state that basis.
- Keep card/financing and other conditions with their steps. Do not make alternatives look like
  an unconditional chain or invent branch controls by guessing from prose.
- If a transition or causal connection is missing, use existing `questions`/`logic` fields to
  describe the gap; do not invent it for a smooth mockup. Do not add unsupported schema fields
  for journey grouping, interaction state or timing.

## Presentation and acceptance

Lead with where the person is and what they do or see. Keep that context stable while the reader
selects individual system steps. Expose every relevant backend hop, interface and data operation;
show actual edges rather than arrows through a deduplicated list of participating systems.
Screens are evidence for the current action, not a detached gallery. Expanded views must retain
screen context, and narrow layouts must not hide later work without a clear control or scroll cue.

Walk the starting action, an intermediate backend step and the UI result in today's and planned
views separately. Check that the correct image and region stay selected, result screens do not
appear early, and every step remains reachable through screen, list and diagram navigation.
Check meaningful failure/conditional paths and asynchronous outputs. Missing screenshots must
be explicit. For synthetic examples, use the reader's requested language in the underlying
assets as well as captions, preserving behaviour, amounts and region alignment; label translated
real screenshots as translations rather than changing source evidence silently.
