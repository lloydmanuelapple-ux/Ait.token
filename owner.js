import { formatSolAmount } from "./payment.js";

const ownerForm = document.querySelector("#owner-auth-form");
const ownerInput = document.querySelector("#owner-token");
const queueStatus = document.querySelector("#queue-status");
const queueRows = document.querySelector("#owner-queue-rows");
const queueState = document.querySelector("#owner-queue-state");
let ownerToken = "";
let requests = [];

function setStatus(message, isError = false) {
  queueStatus.textContent = message;
  queueStatus.classList.toggle("negative", isError);
  queueStatus.classList.toggle("positive", !isError);
}

function addCell(row, text) {
  const cell = document.createElement("td");
  cell.textContent = text;
  row.append(cell);
  return cell;
}

function formatTime(timestamp) {
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.valueOf()) ? "--" : parsed.toLocaleString();
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${ownerToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
  return payload;
}

function renderRequests() {
  queueRows.replaceChildren();
  for (const request of requests) {
    const row = document.createElement("tr");
    addCell(row, `${request.coin.name} (${request.coin.symbol})`);
    const walletCell = addCell(row, request.payer);
    walletCell.className = "owner-wallet-cell";
    addCell(row, `${formatSolAmount(BigInt(request.poolContributionLamports))} SOL · confirmed`);
    addCell(row, formatTime(request.createdAt));
    const statusCell = document.createElement("td");
    const select = document.createElement("select");
    select.className = "owner-status-select";
    select.setAttribute("aria-label", `Update ${request.coin.name} request status`);
    for (const [value, label] of [["waiting_for_creator", "Waiting for creator"], ["in_progress", "In progress"], ["ready", "Ready"]]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      option.selected = request.status === value;
      select.append(option);
    }
    select.addEventListener("change", () => updateStatus(request, select.value, select));
    statusCell.append(select);
    row.append(statusCell);
    queueRows.append(row);
  }
  queueState.hidden = requests.length > 0;
  if (requests.length === 0) queueState.textContent = "No paid requests yet.";
}

async function loadQueue() {
  if (!ownerToken) return;
  setStatus("Loading private queue…");
  queueState.hidden = false;
  queueState.textContent = "Loading paid requests…";
  try {
    requests = await requestJson("/api/owner/coin-requests");
    renderRequests();
    setStatus(`${requests.length} private ${requests.length === 1 ? "request" : "requests"} loaded.`);
  } catch (error) {
    requests = [];
    queueRows.replaceChildren();
    queueState.hidden = false;
    queueState.textContent = "Could not load the private queue.";
    setStatus(error.message, true);
  }
}

async function updateStatus(request, status, select) {
  select.disabled = true;
  try {
    await requestJson(`/api/owner/coin-requests/${encodeURIComponent(request.requestId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    request.status = status;
    setStatus(`Updated ${request.coin.name} request.`);
  } catch (error) {
    select.value = request.status;
    setStatus(error.message, true);
  } finally {
    select.disabled = false;
  }
}

ownerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  ownerToken = ownerInput.value.trim();
  ownerInput.value = "";
  loadQueue();
});
document.querySelector("#refresh-queue").addEventListener("click", loadQueue);