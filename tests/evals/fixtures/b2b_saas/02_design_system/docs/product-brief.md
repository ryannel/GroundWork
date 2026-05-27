# Product Brief: StoreLens Analytics

## System Purpose

StoreLens is a multi-tenant SaaS analytics dashboard that gives operations managers at e-commerce companies real-time visibility into orders, inventory, fulfilment, and team performance across multiple storefronts. Each tenant is an operations team managing one or more retail brands.

## The Problem

E-commerce ops managers today context-switch across four or five separate tools — the OMS, the WMS, the helpdesk, a spreadsheet, and maybe a BI tool — to answer basic operational questions like "Are we on track today?" or "Which fulfilment centre is the bottleneck?". None of these tools speak to each other. When something goes wrong, diagnosis is slow because the data is fragmented.

## Target Users

**Operations Manager**
- Who: Senior ops staff responsible for hitting fulfilment SLAs and managing daily exceptions.
- Job: See the full operation at a glance, catch problems before they escalate, delegate to the right person.
- Success: Reduces time-to-triage for fulfilment exceptions from 30 minutes to under 5. Uses StoreLens as the single tab open during their shift.

**Operations Lead / COO**
- Who: Executive overseeing multiple fulfilment centres or storefronts.
- Job: Understand cross-brand performance, identify capacity trends, spot underperforming centres.
- Success: Can answer "How did last week compare to target?" without a data analyst.

## Capabilities

**Real-Time Operations Dashboard**
Live view of today's order volume, fulfilment rate, backlog, and SLA risk across all storefronts and centres. Auto-refreshes every 60 seconds. Surfaced as a top-level page accessible immediately after login.

**Inventory Health**
Per-SKU and per-location stock levels, cover days, and low-stock alerts. Configurable threshold alerts that fire into the dashboard and optionally to Slack.

**Fulfilment Centre Performance**
Pick rate, pack rate, and throughput per centre per shift. Comparative view across centres. Drill-down to individual shift performance.

**Order Exception Management**
Centralised queue of held, delayed, and flagged orders with root-cause categorisation. Assignable to team members with status tracking.

**Multi-Tenant Isolation**
Each customer organisation sees only their own storefronts and data. Tenant admins can invite team members and assign roles (viewer, manager, admin).

## Constraints

- Must load the main dashboard in under 2 seconds on a standard office connection.
- Must support organisations with up to 20 storefronts and 500,000 orders per day.
- Data freshness: no more than 90 seconds lag from source systems.
- SOC 2 Type II compliance required within 12 months of launch.
- Initial integrations: Shopify, ShipBob. Others in roadmap.

## Success Signal

An ops manager who uses StoreLens as their primary shift tool for 30 consecutive days and reports that it replaced at least two other tools they previously used during a shift.
