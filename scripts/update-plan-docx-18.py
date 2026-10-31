"""Append the approved Issue #18 revision to the legacy Word build plan."""
from pathlib import Path
from tempfile import NamedTemporaryFile
from zipfile import ZipFile
from xml.sax.saxutils import escape
import os

document = Path(__file__).resolve().parents[1] / "docs" / "BiztelAI_CVRDE_PLAN.docx"
paragraphs = [
    "Revision 5 — Approved CVRDE fictional demo scope (Issue #18)",
    "Project structure: Project → Sub-project → Task. Only the PM creates or edits sub-project name, Objective, due date, and owner. Objective helper: What this sub-project must deliver. The sub-project owner creates and assigns tasks, reviews results, and runs meetings.",
    "Eight-step story: PM overview; sub-project owner assignment; task owner evidence and submission; return with reason; correction and resubmission; sign-off and progress; PM meeting action; action task in owner's My work with assignment notification.",
    "Task history is shown as sentences. The real organisation name appears once in the sidebar. Due dates have one format and relative labels. A project switcher is optional for the one-project demo.",
    "At-risk rules: overdue open work, Not started work due within three days, stale work, and explicit risk flags. Stale excludes Done and Submitted. Submitted overdue work reads Overdue, awaiting review. Reset seed: Crankshaft stress analysis is overdue, Friction loss estimation is Not started and due in two days, Cooling jacket design is stale.",
    "My work Due this week covers today through today plus six days. Anyone permitted to view a task may comment, including other task owners in its sub-project.",
    "Demo UI hides groups, reassignment and extension requests, prerequisites, and Linked to. Their schema and APIs remain. VITE_DEMO_MODE=false at frontend build time restores these controls.",
    "Phase 4 notifications: bell and email use the existing notify() and notification_log after commit. Hosted demo email is redirected to one team inbox. Assignment, submission, return, resubmission, sign-off, and meeting action each require a live delivery check after Resend settings are configured.",
    "Known gaps: no PM-owned tasks in demo seed; My submissions exists but Submitted in My work supports the walkthrough; attachments remain in PostgreSQL pending object storage for on-premise. Roadmap: milestones, minutes approval, TRL tracking, multi-level review, on-premise deployment.",
    "Current hosted email verification awaits RESEND_API_KEY, RESEND_FROM, EMAIL_REDIRECT_TO, EMAIL_ENABLED=true, EMAIL_PROVIDER=resend, and PUBLIC_APP_URL in deployment settings. Never store secrets in this plan.",
]

with NamedTemporaryFile(dir=document.parent, suffix=".docx", delete=False) as temp:
    temp_name = temp.name
try:
    with ZipFile(document) as source, ZipFile(temp_name, "w") as target:
        for info in source.infolist():
            data = source.read(info.filename)
            if info.filename == "word/document.xml":
                xml = data.decode("utf-8")
                insert = "".join(
                    f'<w:p><w:r><w:t xml:space="preserve">{escape(line)}</w:t></w:r></w:p>'
                    for line in paragraphs
                )
                marker = "<w:sectPr"
                position = xml.rfind(marker)
                if position < 0:
                    raise ValueError("Word section marker missing")
                xml = xml[:position] + insert + xml[position:]
                data = xml.encode("utf-8")
            target.writestr(info, data)
    os.replace(temp_name, document)
finally:
    if os.path.exists(temp_name):
        os.unlink(temp_name)
