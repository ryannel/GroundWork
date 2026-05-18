#!/usr/bin/env bash

# ==========================================
# CLI CORE CAPABILITIES (TTY DETECTION)
# ==========================================
if [ -t 1 ]; then
  IS_TTY=true
  # 24-bit TrueColor Palette
  export RED='\033[38;2;239;68;68m'
  export GREEN='\033[38;2;34;197;94m'
  export YELLOW='\033[38;2;234;179;8m'
  export BLUE='\033[38;2;59;130;246m'
  export MAGENTA='\033[38;2;217;70;239m'
  export CYAN='\033[38;2;6;182;212m'
  export GRAY='\033[38;2;156;163;175m'
  export BOLD='\033[1m'
  export DIM='\033[2m'
  export NC='\033[0m'
else
  IS_TTY=false
  export RED=''
  export GREEN=''
  export YELLOW=''
  export BLUE=''
  export MAGENTA=''
  export CYAN=''
  export GRAY=''
  export BOLD=''
  export DIM=''
  export NC=''
fi

export CLI_APP_NAME="GroundWork Dev CLI"
export CLI_PRIMARY_COLOR="${BLUE}"

# Padding (Global left margin)
PAD="  "

# Icons (Minimalist Geometrics)
ICON_SUCCESS="✔"
ICON_ERROR="✖"
ICON_INFO="●"
ICON_WARN="⚠"
ICON_STEP="▶"
ICON_SUB="↳"
ICON_ACTIVE="❯"

function print_logo() {
  echo ""
  if [ -z "$1" ]; then
    echo -e "${PAD}${BOLD}${CLI_PRIMARY_COLOR}◢◤ ${CLI_APP_NAME}${NC}"
  else
    echo -e "${PAD}${BOLD}${CLI_PRIMARY_COLOR}◢◤ ${CLI_APP_NAME}${NC} ${DIM}— $1${NC}"
  fi
  echo ""
}

function print_step() {
  echo -e "\n${PAD}${CLI_PRIMARY_COLOR}${ICON_STEP}${NC} ${BOLD}$1${NC}"
}

function print_substep() {
  echo -e "${PAD}${PAD}${DIM}${ICON_SUB} $1${NC}"
}

function print_info() {
  echo -e "${PAD}${DIM}${ICON_INFO}${NC} $1"
}

function print_success() {
  echo -e "${PAD}${GREEN}${ICON_SUCCESS}${NC} $1"
}

function print_error() {
  echo -e "${PAD}${RED}${ICON_ERROR}${NC} $1"
}

function print_warn() {
  echo -e "${PAD}${YELLOW}${ICON_WARN}${NC} $1"
}

function print_category() {
  echo -e "\n  ${DIM}■ ${NC}${BOLD}$1${NC}"
}

function print_cmd() {
  printf "    ${CYAN}%-15s${NC} %s\n" "$1" "$2"
}

function print_panel_start() {
  local title="$1"
  if [ -n "$title" ]; then
    echo -e "${PAD}${DIM}╭─ ${NC}${BOLD}${title}${NC} ${DIM}─────────────────────────────────────────╮${NC}"
  else
    echo -e "${PAD}${DIM}╭──────────────────────────────────────────────────────────╮${NC}"
  fi
}

function print_panel_row() {
  local col1="$1"
  local col2="$2"
  local col3="$3"
  printf "${PAD}${DIM}│${NC}  %-25s %-15s %-12s ${DIM}│${NC}\n" "$col1" "$col2" "$col3"
}

function print_panel_end() {
  echo -e "${PAD}${DIM}╰──────────────────────────────────────────────────────────╯${NC}"
}

function fail() {
  echo ""
  echo -e "${PAD}${RED}╭──────────────────────────────────────────────────────────╮${NC}"
  echo -e "${PAD}${RED}│${NC}  ${RED}${ICON_ERROR}${NC} ${BOLD}ERROR:${NC} $1"
  echo -e "${PAD}${RED}╰──────────────────────────────────────────────────────────╯${NC}"
  echo ""
  exit 1
}
