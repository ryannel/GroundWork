# 01. Project Initialization & Discovery

The Initialization & Discovery phase is the very first step in the GroundWork lifecycle. It establishes the high-level boundaries, product vision, and overarching design style before any code scanning or generation begins.

## 1. The Executive Summary
*Defining the "Why" and "Who"*

Before diving into the architecture, the agent must facilitate a discussion with the human to clearly define the product vision.
- **Workflow:** Utilizing BMAD-style collaborative elicitation, the agent asks targeted questions to define the target users, core differentiators, and project classification (brownfield vs greenfield).
- **Output:** It generates a dense, zero-fluff summary of the business goals.
- **Why it matters:** This context prevents the AI from making generic assumptions and ensures all subsequent technical decisions align with the actual business intent.

## 2. Design & UX Philosophy
*Establishing the Global Style*

We capture the overarching design style globally, so that individual feature implementations have a consistent visual language to pull from.
- **Greenfield Projects:** We work collaboratively with the AI to develop a foundational UI/UX style and brand guidelines from scratch.
- **Brownfield Projects:** The agent extracts existing styles (Design Tokens, Component Rules, Tailwind configs) and asks targeted questions to fill any gaps.
- **Output:** A central `design-system.md` document containing objective Design Tokens (primary hex colors, typography, component library rules).

## 3. Just-In-Time Generation
*No Ghost Folders*

GroundWork operates on a strict Just-In-Time (JIT) generation principle.
- It refuses to create empty files or bloated folder structures (like empty `docs/services/` directories).
- It only provisions directories and files when there is verified, substantive content to write to them.
