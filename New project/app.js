const STORAGE_KEY = "library-nexus-state-v1";
const SESSION_KEY = "library-nexus-session-v1";
const DATA_VERSION = 2;
const DEFAULT_DUE_WINDOW_DAYS = 3;
const DEFAULT_LOAN_DAYS = 14;

const appRoot = document.getElementById("app");

let state = loadState();
let session = loadSession();
let flash = null;
const viewState = {
  section: "dashboard",
  adminBookSearch: "",
  studentSearch: "",
  catalogueSearch: "",
  catalogueAvailability: "all",
  editingBookId: null,
  editingStudentId: null,
  selectedCardStudentId: null,
};

syncSession();
renderApp();

document.addEventListener("click", handleClick);
document.addEventListener("submit", handleSubmit);
document.addEventListener("input", handleModelUpdate);
document.addEventListener("change", handleModelUpdate);

function handleClick(event) {
  const target = event.target.closest("[data-action], [data-nav]");
  if (!target) {
    return;
  }

  if (target.dataset.nav) {
    viewState.section = target.dataset.nav;
    clearEditingState();
    renderApp();
    return;
  }

  const action = target.dataset.action;

  switch (action) {
    case "fill-demo":
      fillDemoCredentials(target.dataset.role, target.dataset.login, target.dataset.password);
      break;
    case "logout":
      session = null;
      clearSession();
      clearEditingState();
      flashMessage("info", "You have been logged out.");
      renderApp();
      break;
    case "dismiss-flash":
      flash = null;
      renderApp();
      break;
    case "edit-book":
      viewState.section = "books";
      viewState.editingBookId = target.dataset.id;
      renderApp();
      break;
    case "cancel-book-edit":
      viewState.editingBookId = null;
      renderApp();
      break;
    case "delete-book":
      deleteBook(target.dataset.id);
      break;
    case "edit-student":
      viewState.section = "students";
      viewState.editingStudentId = target.dataset.id;
      renderApp();
      break;
    case "cancel-student-edit":
      viewState.editingStudentId = null;
      renderApp();
      break;
    case "delete-student":
      deleteStudent(target.dataset.id);
      break;
    case "preview-student-card":
      viewState.section = "students";
      viewState.selectedCardStudentId = target.dataset.id;
      renderApp();
      break;
    case "download-student-card":
      exportStudentCardPdf(target.dataset.id);
      break;
    case "download-my-card": {
      const currentUser = getCurrentUser();
      if (currentUser && currentUser.role === "student") {
        exportStudentCardPdf(currentUser.id);
      }
      break;
    }
    case "return-loan":
      returnLoan(target.dataset.id);
      break;
    default:
      break;
  }
}

function handleSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  if (form.id === "login-form") {
    event.preventDefault();
    loginUser(form);
    return;
  }

  if (!getCurrentUser()) {
    return;
  }

  switch (form.id) {
    case "book-form":
      event.preventDefault();
      saveBook(form);
      break;
    case "student-form":
      event.preventDefault();
      saveStudent(form);
      break;
    case "issue-form":
      event.preventDefault();
      issueBook(form);
      break;
    case "profile-form":
      event.preventDefault();
      updateProfile(form);
      break;
    case "password-form":
      event.preventDefault();
      updatePassword(form);
      break;
    default:
      break;
  }
}

function handleModelUpdate(event) {
  const field = event.target;
  if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement)) {
    return;
  }

  const model = field.dataset.model;
  if (!model) {
    return;
  }

  viewState[model] = field.value;
  const fieldId = field.id;
  const selectionStart = field instanceof HTMLInputElement ? field.selectionStart : null;
  const selectionEnd = field instanceof HTMLInputElement ? field.selectionEnd : null;
  renderApp();
  if (event.type === "input" && fieldId) {
    requestAnimationFrame(() => {
      const nextField = document.getElementById(fieldId);
      if (nextField instanceof HTMLInputElement) {
        nextField.focus();
        if (selectionStart !== null && selectionEnd !== null) {
          nextField.setSelectionRange(selectionStart, selectionEnd);
        }
      }
    });
  }
}

function renderApp() {
  syncSession();
  applySiteSettings();

  if (!session) {
    appRoot.innerHTML = renderLogin();
    return;
  }

  const user = getCurrentUser();
  if (!user) {
    appRoot.innerHTML = renderLogin();
    return;
  }

  const navItems = getNavItems(user.role);
  const section = navItems.some((item) => item.key === viewState.section)
    ? viewState.section
    : "dashboard";

  appRoot.innerHTML = `
    <div class="layout">
      <aside class="sidebar">
        <div class="brand-mark">
          <span class="eyebrow">Library Management</span>
          <h1>${escapeHtml(getSettings().siteName)}</h1>
          <p class="brand-subtitle">${escapeHtml(getSettings().siteSubtitle)}</p>
          <p>${escapeHtml(getSettings().sidebarDescription)}</p>
          ${renderCreatorNote()}
        </div>
        <div class="user-card">
          <span class="user-badge">${escapeHtml(user.role)}</span>
          <h3>${escapeHtml(user.name)}</h3>
          <p>Login ID: ${escapeHtml(user.loginId)}</p>
          <p>${escapeHtml(user.email || "No email added")}</p>
          ${
            user.role === "student"
              ? `<p>${escapeHtml(user.department)} · ${escapeHtml(user.year)}</p><p>${escapeHtml(user.contactNumber || "No contact number added")}</p>`
              : `<p>Administrator access is active.</p>`
          }
        </div>
        <nav class="nav-list">
          ${navItems
            .map(
              (item) => `
                <button class="nav-button ${item.key === section ? "active" : ""}" data-nav="${item.key}">
                  ${escapeHtml(item.label)}
                </button>
              `
            )
            .join("")}
        </nav>
        <div class="sidebar-footer">
          <button class="secondary-button" data-action="logout">Logout</button>
        </div>
      </aside>
      <main class="main-panel">
        <div class="topbar">
          <div class="section-title">
            <h2>${escapeHtml(getSectionMeta(user.role, section).title)}</h2>
            <p>${escapeHtml(getSectionMeta(user.role, section).description)}</p>
          </div>
          <div class="topbar-actions">
            <div class="status-chip">${escapeHtml(formatLongDate(new Date().toISOString()))}</div>
            <button class="secondary-button" data-action="logout">Logout</button>
          </div>
        </div>
        ${renderAnnouncement()}
        ${renderFlash()}
        ${renderSection(user, section)}
      </main>
    </div>
  `;
}

function renderFlash() {
  if (!flash) {
    return "";
  }

  return `
    <div class="flash ${escapeHtml(flash.type)}">
      <span>${escapeHtml(flash.message)}</span>
      <button class="text-button" data-action="dismiss-flash">Dismiss</button>
    </div>
  `;
}

function renderAnnouncement(context = "panel") {
  const announcement = normalizeText(getSettings().announcement);
  if (!announcement) {
    return "";
  }

  const className = context === "login" ? "flash info announcement-banner login" : "flash info announcement-banner";
  return `
    <div class="${className}">
      <span>${escapeHtml(announcement)}</span>
    </div>
  `;
}

function renderCreatorNote(tone = "") {
  const creatorName = normalizeText(getSettings().creatorName);
  if (!creatorName) {
    return "";
  }

  const className = tone ? `creator-note ${tone}` : "creator-note";
  return `<p class="${className}">Made by ${escapeHtml(creatorName)}</p>`;
}

function renderLogin() {
  const admin = getAdminUser();
  const demoStudent = getStudents()
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))[0];

  return `
    <div class="login-shell">
      <div class="login-card">
        <section class="login-hero">
          <span class="eyebrow">${escapeHtml(getSettings().loginEyebrow)}</span>
          <h1>${escapeHtml(getSettings().loginHeadline)}</h1>
          <p class="hero-copy">${escapeHtml(getSettings().loginDescription)}</p>
          <div class="feature-grid">
            <div class="feature-card">
              <h3>Admin oversight</h3>
              <p>Manage books, student accounts, circulation, and overdue tracking from one clean workspace.</p>
            </div>
            <div class="feature-card">
              <h3>Student self-service</h3>
              <p>Students can sign in, browse the catalogue, and check their own borrowing history and due dates.</p>
            </div>
            <div class="feature-card">
              <h3>Daily circulation</h3>
              <p>Keep day-to-day library work simple with quick issue, return, stock, and activity visibility.</p>
            </div>
          </div>
        </section>
        <section class="login-form-panel">
          <div class="panel-header">
            <p class="brand-subtitle light">${escapeHtml(getSettings().siteSubtitle)}</p>
            <h2>Sign in</h2>
            <p>Sign in to the ${escapeHtml(getSettings().siteName)} portal with a seeded demo account, or create more student logins from the admin panel after entry.</p>
            ${renderCreatorNote("light")}
          </div>
          ${renderAnnouncement("login")}
          <div class="demo-grid">
            <div class="demo-card">
              <strong>Admin panel</strong>
              <span>Login ID: ${escapeHtml(admin ? admin.loginId : "admin01")}</span>
              <span>Password: ${escapeHtml(admin ? admin.password : "Admin@123")}</span>
              <button
                class="text-button"
                type="button"
                data-action="fill-demo"
                data-role="admin"
                data-login="${escapeHtml(admin ? admin.loginId : "admin01")}"
                data-password="${escapeHtml(admin ? admin.password : "Admin@123")}"
              >
                Use admin demo
              </button>
            </div>
            <div class="demo-card">
              <strong>Student panel</strong>
              <span>Login ID: ${escapeHtml(demoStudent ? demoStudent.loginId : "STU1001")}</span>
              <span>Password: ${escapeHtml(demoStudent ? demoStudent.password : "Student@123")}</span>
              <button
                class="text-button"
                type="button"
                data-action="fill-demo"
                data-role="student"
                data-login="${escapeHtml(demoStudent ? demoStudent.loginId : "STU1001")}"
                data-password="${escapeHtml(demoStudent ? demoStudent.password : "Student@123")}"
              >
                Use student demo
              </button>
            </div>
          </div>
          <form id="login-form" class="auth-form">
            <div class="form-field">
              <label for="login-role">Panel</label>
              <select id="login-role" name="role" required>
                <option value="admin">Admin</option>
                <option value="student">Student</option>
              </select>
            </div>
            <div class="form-field">
              <label for="login-id">Login ID</label>
              <input id="login-id" name="loginId" type="text" placeholder="Enter your login ID" required />
            </div>
            <div class="form-field">
              <label for="login-password">Password</label>
              <input id="login-password" name="password" type="password" placeholder="Enter your password" required />
            </div>
            <div class="auth-actions">
              <button class="primary-button" type="submit">Open dashboard</button>
            </div>
          </form>
        </section>
      </div>
    </div>
  `;
}

function renderSection(user, section) {
  if (user.role === "admin") {
    switch (section) {
      case "dashboard":
        return renderAdminDashboard();
      case "books":
        return renderBooksSection();
      case "students":
        return renderStudentsSection();
      case "circulation":
        return renderCirculationSection();
      case "activity":
        return renderActivitySection();
      case "account":
        return renderAccountSection(user);
      default:
        return renderAdminDashboard();
    }
  }

  switch (section) {
    case "dashboard":
      return renderStudentDashboard(user);
    case "catalogue":
      return renderCatalogueSection(user);
    case "my-books":
      return renderMyBooksSection(user);
    case "account":
      return renderAccountSection(user);
    default:
      return renderStudentDashboard(user);
  }
}

function renderAdminDashboard() {
  const books = getBooks();
  const students = getStudents();
  const activeLoans = getActiveLoans();
  const overdueLoans = getOverdueLoans();
  const availableCopies = books.reduce((total, book) => total + getAvailableCopies(book.id), 0);
  const lowStockBooks = books
    .filter((book) => getAvailableCopies(book.id) <= 1)
    .sort((a, b) => getAvailableCopies(a.id) - getAvailableCopies(b.id))
    .slice(0, 5);

  return `
    <section class="stack">
      <div class="metric-grid">
        ${renderMetricCard("Book titles", books.length, `${books.reduce((sum, book) => sum + book.totalCopies, 0)} total copies in stock`)}
        ${renderMetricCard("Available copies", availableCopies, `${activeLoans.length} copies currently issued`)}
        ${renderMetricCard("Active loans", activeLoans.length, `${overdueLoans.length} overdue right now`)}
        ${renderMetricCard("Students", students.length, "Login-ready student accounts")}
      </div>
      <div class="content-grid">
        <div class="content-card">
          <div class="panel-head">
            <div>
              <h3 class="panel-title">Low stock watchlist</h3>
              <p>Titles that may need restocking soon.</p>
            </div>
          </div>
          ${
            lowStockBooks.length
              ? `
                <div class="due-list">
                  ${lowStockBooks
                    .map(
                      (book) => `
                        <div class="due-item">
                          <h3>${escapeHtml(book.title)}</h3>
                          <div class="stat-inline">
                            <span>${escapeHtml(book.author)}</span>
                            <span>${escapeHtml(book.category)}</span>
                            <span>Shelf ${escapeHtml(book.shelf)}</span>
                          </div>
                          <div class="catalog-footer">
                            ${renderAvailabilityTag(book.id)}
                          </div>
                        </div>
                      `
                    )
                    .join("")}
                </div>
              `
              : renderEmptyState("Stock looks healthy", "No titles are sitting in the low stock range right now.")
          }
        </div>
        <div class="content-card">
          <div class="panel-head">
            <div>
              <h3 class="panel-title">Overdue loans</h3>
              <p>Students who need a reminder or follow-up.</p>
            </div>
          </div>
          ${
            overdueLoans.length
              ? `
                <div class="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Book</th>
                        <th>Student</th>
                        <th>Due</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${overdueLoans
                        .map((loan) => {
                          const book = getBookById(loan.bookId);
                          const student = getUserById(loan.studentId);
                          return `
                            <tr>
                              <td>${escapeHtml(book ? book.title : "Unknown title")}</td>
                              <td>${escapeHtml(student ? student.name : "Unknown student")}</td>
                              <td>${escapeHtml(formatShortDate(loan.dueOn))}</td>
                              <td>${renderLoanStatusTag(loan)}</td>
                            </tr>
                          `;
                        })
                        .join("")}
                    </tbody>
                  </table>
                </div>
              `
              : renderEmptyState("No overdue books", "Great news. Every active loan is still inside its due window.")
          }
        </div>
      </div>
      <div class="content-card">
        <div class="panel-head">
          <div>
            <h3 class="panel-title">Recent activity</h3>
            <p>Latest updates across books, student accounts, and circulation.</p>
          </div>
        </div>
        ${renderActivityList(getRecentActivities(6))}
      </div>
    </section>
  `;
}

function renderBooksSection() {
  const editingBook = viewState.editingBookId ? getBookById(viewState.editingBookId) : null;
  const books = getBooks()
    .filter((book) => matchesBookSearch(book, viewState.adminBookSearch))
    .sort((a, b) => a.title.localeCompare(b.title));

  return `
    <section class="split-grid">
      <div class="content-card">
        <div class="panel-head">
          <div>
            <h3 class="panel-title">${editingBook ? "Update book" : "Add a new book"}</h3>
            <p>Keep the catalogue accurate so issue tracking stays reliable.</p>
          </div>
        </div>
        <form id="book-form" class="panel-form">
          <input type="hidden" name="bookId" value="${editingBook ? escapeHtml(editingBook.id) : ""}" />
          <div class="form-field">
            <label for="book-title">Title</label>
            <input id="book-title" name="title" type="text" value="${editingBook ? escapeHtml(editingBook.title) : ""}" required />
          </div>
          <div class="form-row">
            <div class="form-field">
              <label for="book-author">Author</label>
              <input id="book-author" name="author" type="text" value="${editingBook ? escapeHtml(editingBook.author) : ""}" required />
            </div>
            <div class="form-field">
              <label for="book-category">Category</label>
              <input id="book-category" name="category" type="text" value="${editingBook ? escapeHtml(editingBook.category) : ""}" required />
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label for="book-isbn">ISBN</label>
              <input id="book-isbn" name="isbn" type="text" value="${editingBook ? escapeHtml(editingBook.isbn) : ""}" required />
            </div>
            <div class="form-field">
              <label for="book-shelf">Shelf</label>
              <input id="book-shelf" name="shelf" type="text" value="${editingBook ? escapeHtml(editingBook.shelf) : ""}" required />
            </div>
          </div>
          <div class="form-field">
            <label for="book-copies">Total copies</label>
            <input id="book-copies" name="totalCopies" type="number" min="1" step="1" value="${editingBook ? editingBook.totalCopies : 1}" required />
            <p class="helper-text">If this title is already issued, total copies cannot go below its current active loan count.</p>
          </div>
          <div class="panel-actions">
            <button class="primary-button" type="submit">${editingBook ? "Save book" : "Add book"}</button>
            ${
              editingBook
                ? `<button class="secondary-button" type="button" data-action="cancel-book-edit">Cancel</button>`
                : ""
            }
          </div>
        </form>
      </div>
      <div class="content-card">
        <div class="panel-head">
          <div>
            <h3 class="panel-title">Catalogue</h3>
            <p>Review availability, make edits, or remove unused records.</p>
          </div>
        </div>
        <div class="search-row">
          <div class="form-field">
            <label for="admin-book-search">Search books</label>
            <input
              id="admin-book-search"
              type="text"
              placeholder="Title, author, category, or ISBN"
              value="${escapeHtml(viewState.adminBookSearch)}"
              data-model="adminBookSearch"
            />
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Book</th>
                <th>Category</th>
                <th>Copies</th>
                <th>Shelf</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                books.length
                  ? books
                      .map((book) => {
                        const totalLoans = state.loans.filter((loan) => loan.bookId === book.id).length;
                        return `
                          <tr>
                            <td>
                              <strong>${escapeHtml(book.title)}</strong><br />
                              <span class="muted">${escapeHtml(book.author)} · ${escapeHtml(book.isbn)}</span>
                            </td>
                            <td>${escapeHtml(book.category)}</td>
                            <td>
                              ${renderAvailabilityTag(book.id)}
                              <div class="helper-text">${getAvailableCopies(book.id)} of ${book.totalCopies} available</div>
                            </td>
                            <td>${escapeHtml(book.shelf)}</td>
                            <td>
                              <div class="table-actions">
                                <button class="secondary-button small" type="button" data-action="edit-book" data-id="${escapeHtml(book.id)}">Edit</button>
                                <button class="danger-button small" type="button" data-action="delete-book" data-id="${escapeHtml(book.id)}">
                                  ${totalLoans ? "Locked" : "Delete"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        `;
                      })
                      .join("")
                  : `
                    <tr>
                      <td colspan="5">${renderInlineEmpty("No matching books yet.")}</td>
                    </tr>
                  `
              }
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

function renderStudentsSection() {
  const editingStudent = viewState.editingStudentId ? getUserById(viewState.editingStudentId) : null;
  const students = getStudents()
    .filter((student) => matchesStudentSearch(student, viewState.studentSearch))
    .sort((a, b) => a.name.localeCompare(b.name));
  const selectedCardStudent =
    (viewState.selectedCardStudentId && getUserById(viewState.selectedCardStudentId)) || students[0] || null;

  return `
    <section class="stack">
      <div class="split-grid">
        <div class="content-card">
          <div class="panel-head">
            <div>
              <h3 class="panel-title">${editingStudent ? "Update student" : "Create student login"}</h3>
              <p>Only admin and student access are enabled in this system, so every new member becomes a student account with login, contact, and library card details.</p>
            </div>
          </div>
          <form id="student-form" class="panel-form">
            <input type="hidden" name="studentId" value="${editingStudent ? escapeHtml(editingStudent.id) : ""}" />
            <div class="form-row">
              <div class="form-field">
                <label for="student-name">Full name</label>
                <input id="student-name" name="name" type="text" value="${editingStudent ? escapeHtml(editingStudent.name) : ""}" required />
              </div>
              <div class="form-field">
                <label for="student-login">Login ID</label>
                <input id="student-login" name="loginId" type="text" value="${editingStudent ? escapeHtml(editingStudent.loginId) : ""}" required />
              </div>
            </div>
            <div class="form-row">
              <div class="form-field">
                <label for="student-department">Department</label>
                <input id="student-department" name="department" type="text" value="${editingStudent ? escapeHtml(editingStudent.department) : ""}" required />
              </div>
              <div class="form-field">
                <label for="student-year">Year / Section</label>
                <input id="student-year" name="year" type="text" value="${editingStudent ? escapeHtml(editingStudent.year) : ""}" required />
              </div>
            </div>
            <div class="form-row">
              <div class="form-field">
                <label for="student-email">Email</label>
                <input id="student-email" name="email" type="email" value="${editingStudent ? escapeHtml(editingStudent.email) : ""}" required />
              </div>
              <div class="form-field">
                <label for="student-contact">Contact number</label>
                <input
                  id="student-contact"
                  name="contactNumber"
                  type="tel"
                  inputmode="numeric"
                  minlength="10"
                  maxlength="16"
                  value="${editingStudent ? escapeHtml(editingStudent.contactNumber || "") : ""}"
                  placeholder="Student phone number"
                  required
                />
              </div>
            </div>
            <div class="form-row">
              <div class="form-field">
                <label for="student-password">${editingStudent ? "New password" : "Password"}</label>
                <input
                  id="student-password"
                  name="password"
                  type="text"
                  ${editingStudent ? "" : "required"}
                  placeholder="${editingStudent ? "Leave blank to keep current password" : "Set an initial password"}"
                />
              </div>
            </div>
            <div class="panel-actions">
              <button class="primary-button" type="submit">${editingStudent ? "Save student" : "Create account"}</button>
              ${
                editingStudent
                  ? `<button class="secondary-button" type="button" data-action="cancel-student-edit">Cancel</button>`
                  : ""
              }
            </div>
          </form>
        </div>
        <div class="content-card">
          <div class="panel-head">
            <div>
              <h3 class="panel-title">Student accounts</h3>
              <p>Manage login credentials, preview library cards, and check who currently has books checked out.</p>
            </div>
          </div>
          <div class="search-row">
            <div class="form-field">
              <label for="student-search">Search students</label>
              <input
                id="student-search"
                type="text"
                placeholder="Name, login ID, department, email, or contact"
                value="${escapeHtml(viewState.studentSearch)}"
                data-model="studentSearch"
              />
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Department</th>
                  <th>Active loans</th>
                  <th>Credentials</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${
                  students.length
                    ? students
                        .map((student) => {
                          const totalLoans = state.loans.filter((loan) => loan.studentId === student.id).length;
                          const activeCount = getStudentActiveLoans(student.id).length;
                          return `
                            <tr>
                              <td>
                                <strong>${escapeHtml(student.name)}</strong><br />
                                <span class="muted">${escapeHtml(student.email)}</span><br />
                                <span class="muted">${escapeHtml(student.contactNumber || "Contact not added")}</span>
                              </td>
                              <td>${escapeHtml(student.department)} · ${escapeHtml(student.year)}</td>
                              <td>${activeCount}</td>
                              <td>
                                <strong>${escapeHtml(student.loginId)}</strong><br />
                                <span class="muted">${student.password ? "Password set" : "Password missing"}</span>
                              </td>
                              <td>
                                <div class="table-actions">
                                  <button class="secondary-button small" type="button" data-action="edit-student" data-id="${escapeHtml(student.id)}">Edit</button>
                                  <button class="secondary-button small" type="button" data-action="preview-student-card" data-id="${escapeHtml(student.id)}">Card</button>
                                  <button class="primary-button small" type="button" data-action="download-student-card" data-id="${escapeHtml(student.id)}">PDF</button>
                                  <button class="danger-button small" type="button" data-action="delete-student" data-id="${escapeHtml(student.id)}">
                                    ${totalLoans ? "Locked" : "Delete"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          `;
                        })
                        .join("")
                    : `
                      <tr>
                        <td colspan="5">${renderInlineEmpty("No matching student accounts yet.")}</td>
                      </tr>
                    `
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="content-card">
        <div class="panel-head">
          <div>
            <h3 class="panel-title">Digital student library card</h3>
            <p>Preview the selected student's card with a QR code and export it through the browser's Save as PDF flow.</p>
          </div>
        </div>
        ${
          selectedCardStudent
            ? renderStudentLibraryCard(selectedCardStudent, { showActions: true, actionId: selectedCardStudent.id })
            : renderEmptyState("No student selected", "Create or choose a student account to generate a digital library card.")
        }
      </div>
    </section>
  `;
}
function renderCirculationSection() {
  const students = getStudents().sort((a, b) => a.name.localeCompare(b.name));
  const issuableBooks = getBooks()
    .filter((book) => getAvailableCopies(book.id) > 0)
    .sort((a, b) => a.title.localeCompare(b.title));
  const activeLoans = getActiveLoans().sort((a, b) => new Date(a.dueOn) - new Date(b.dueOn));

  return `
    <section class="split-grid">
      <div class="content-card">
        <div class="panel-head">
          <div>
            <h3 class="panel-title">Issue a book</h3>
            <p>Create a loan record and assign a due date from one place.</p>
          </div>
        </div>
        <form id="issue-form" class="panel-form">
          <div class="form-field">
            <label for="issue-student">Student</label>
            <select id="issue-student" name="studentId" required>
              <option value="">Select a student</option>
              ${students
                .map(
                  (student) => `
                    <option value="${escapeHtml(student.id)}">
                      ${escapeHtml(student.name)} (${escapeHtml(student.loginId)})
                    </option>
                  `
                )
                .join("")}
            </select>
          </div>
          <div class="form-field">
            <label for="issue-book">Book</label>
            <select id="issue-book" name="bookId" required>
              <option value="">Select a book</option>
              ${issuableBooks
                .map(
                  (book) => `
                    <option value="${escapeHtml(book.id)}">
                      ${escapeHtml(book.title)} (${getAvailableCopies(book.id)} available)
                    </option>
                  `
                )
                .join("")}
            </select>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label for="issued-on">Issued on</label>
              <input id="issued-on" name="issuedOn" type="date" value="${escapeHtml(todayISO())}" required />
            </div>
            <div class="form-field">
              <label for="due-on">Due on</label>
              <input id="due-on" name="dueOn" type="date" value="${escapeHtml(offsetISO(getDefaultLoanDays()))}" required />
            </div>
          </div>
          <div class="panel-actions">
            <button class="primary-button" type="submit">Issue book</button>
          </div>
        </form>
      </div>
      <div class="content-card">
        <div class="panel-head">
          <div>
            <h3 class="panel-title">Active circulation</h3>
            <p>Process returns and keep an eye on approaching due dates.</p>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Book</th>
                <th>Student</th>
                <th>Issued</th>
                <th>Due</th>
                <th>Status</th>
                <th>Return</th>
              </tr>
            </thead>
            <tbody>
              ${
                activeLoans.length
                  ? activeLoans
                      .map((loan) => {
                        const book = getBookById(loan.bookId);
                        const student = getUserById(loan.studentId);
                        return `
                          <tr>
                            <td>${escapeHtml(book ? book.title : "Unknown title")}</td>
                            <td>${escapeHtml(student ? student.name : "Unknown student")}</td>
                            <td>${escapeHtml(formatShortDate(loan.issuedOn))}</td>
                            <td>${escapeHtml(formatShortDate(loan.dueOn))}</td>
                            <td>${renderLoanStatusTag(loan)}</td>
                            <td>
                              <button class="primary-button small" type="button" data-action="return-loan" data-id="${escapeHtml(loan.id)}">
                                Mark returned
                              </button>
                            </td>
                          </tr>
                        `;
                      })
                      .join("")
                  : `
                    <tr>
                      <td colspan="6">${renderInlineEmpty("No books are currently issued.")}</td>
                    </tr>
                  `
              }
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

function renderActivitySection() {
  return `
    <section class="content-card">
      <div class="panel-head">
        <div>
          <h3 class="panel-title">Audit trail</h3>
          <p>Every major action gets logged here so the library workflow stays visible.</p>
        </div>
      </div>
      ${renderActivityList(getRecentActivities(20))}
    </section>
  `;
}

function renderStudentDashboard(user) {
  const activeLoans = getStudentActiveLoans(user.id);
  const history = getStudentLoanHistory(user.id);
  const overdue = activeLoans.filter((loan) => isOverdue(loan));
  const dueSoon = activeLoans.filter((loan) => isDueSoon(loan));
  const availableBooks = getBooks().filter((book) => getAvailableCopies(book.id) > 0).length;

  return `
    <section class="stack">
      <div class="metric-grid">
        ${renderMetricCard("My active books", activeLoans.length, `${history.length} total borrowing records`)}
        ${renderMetricCard("Due soon", dueSoon.length, `${getDueSoonDays()}-day reminder window`)}
        ${renderMetricCard("Overdue", overdue.length, overdue.length ? "Please visit the library desk" : "All clear")}
        ${renderMetricCard("Catalogue ready", availableBooks, "Books currently available to issue")}
      </div>
      <div class="content-grid">
        <div class="content-card">
          <div class="panel-head">
            <div>
              <h3 class="panel-title">Books due soon</h3>
              <p>Keep these on your radar so you return or renew them on time.</p>
            </div>
          </div>
          ${
            activeLoans.length
              ? `
                <div class="due-list">
                  ${activeLoans
                    .sort((a, b) => new Date(a.dueOn) - new Date(b.dueOn))
                    .map((loan) => {
                      const book = getBookById(loan.bookId);
                      return `
                        <div class="due-item">
                          <h3>${escapeHtml(book ? book.title : "Unknown title")}</h3>
                          <div class="stat-inline">
                            <span>Issued ${escapeHtml(formatShortDate(loan.issuedOn))}</span>
                            <span>Due ${escapeHtml(formatShortDate(loan.dueOn))}</span>
                          </div>
                          ${renderLoanStatusTag(loan)}
                        </div>
                      `;
                    })
                    .join("")}
                </div>
              `
              : renderEmptyState("No active books", "You do not have any books issued at the moment.")
          }
        </div>
        <div class="content-card">
          <div class="panel-head">
            <div>
              <h3 class="panel-title">Collection snapshot</h3>
              <p>Browse a few titles that are currently ready to issue.</p>
            </div>
          </div>
          ${renderCataloguePreview()}
        </div>
      </div>
    </section>
  `;
}

function renderCatalogueSection(user) {
  const books = getBooks()
    .filter((book) => matchesBookSearch(book, viewState.catalogueSearch))
    .filter((book) => {
      if (viewState.catalogueAvailability === "available") {
        return getAvailableCopies(book.id) > 0;
      }
      if (viewState.catalogueAvailability === "issued") {
        return getAvailableCopies(book.id) === 0;
      }
      return true;
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  return `
    <section class="stack">
      <div class="content-card">
        <div class="panel-head">
          <div>
            <h3 class="panel-title">Browse catalogue</h3>
            <p>Students can view availability here. Issuing and returns stay with the admin desk.</p>
          </div>
        </div>
        <div class="search-row">
          <div class="form-field">
            <label for="catalogue-search">Search</label>
            <input
              id="catalogue-search"
              type="text"
              placeholder="Title, author, category, or ISBN"
              value="${escapeHtml(viewState.catalogueSearch)}"
              data-model="catalogueSearch"
            />
          </div>
          <div class="form-field">
            <label for="catalogue-availability">Availability</label>
            <select id="catalogue-availability" data-model="catalogueAvailability">
              <option value="all" ${viewState.catalogueAvailability === "all" ? "selected" : ""}>All books</option>
              <option value="available" ${viewState.catalogueAvailability === "available" ? "selected" : ""}>Available now</option>
              <option value="issued" ${viewState.catalogueAvailability === "issued" ? "selected" : ""}>Fully issued</option>
            </select>
          </div>
        </div>
      </div>
      ${
        books.length
          ? `
            <div class="catalog-grid">
              ${books
                .map((book) => {
                  const myLoan = getStudentActiveLoans(user.id).find((loan) => loan.bookId === book.id);
                  return `
                    <article class="catalog-card">
                      <div>
                        <h3>${escapeHtml(book.title)}</h3>
                        <div class="catalog-meta">
                          <span>${escapeHtml(book.author)}</span>
                          <span>${escapeHtml(book.category)}</span>
                        </div>
                      </div>
                      <div class="catalog-meta">
                        <span>ISBN ${escapeHtml(book.isbn)}</span>
                        <span>Shelf ${escapeHtml(book.shelf)}</span>
                      </div>
                      <div class="catalog-footer">
                        ${renderAvailabilityTag(book.id)}
                        ${
                          myLoan
                            ? `<div class="helper-text">You currently have this book. Due ${escapeHtml(formatShortDate(myLoan.dueOn))}.</div>`
                            : `<div class="helper-text">Available copies: ${getAvailableCopies(book.id)} of ${book.totalCopies}</div>`
                        }
                      </div>
                    </article>
                  `;
                })
                .join("")}
            </div>
          `
          : renderEmptyState("No books match that search", "Try a broader search term or switch the availability filter.")
      }
    </section>
  `;
}

function renderMyBooksSection(user) {
  const activeLoans = getStudentActiveLoans(user.id).sort((a, b) => new Date(a.dueOn) - new Date(b.dueOn));
  const history = getStudentLoanHistory(user.id).sort((a, b) => new Date(b.issuedOn) - new Date(a.issuedOn));

  return `
    <section class="stack">
      <div class="content-card">
        <div class="panel-head">
          <div>
            <h3 class="panel-title">Current books</h3>
            <p>Your active borrowing list and current due dates.</p>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Book</th>
                <th>Issued</th>
                <th>Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${
                activeLoans.length
                  ? activeLoans
                      .map((loan) => {
                        const book = getBookById(loan.bookId);
                        return `
                          <tr>
                            <td>${escapeHtml(book ? book.title : "Unknown title")}</td>
                            <td>${escapeHtml(formatShortDate(loan.issuedOn))}</td>
                            <td>${escapeHtml(formatShortDate(loan.dueOn))}</td>
                            <td>${renderLoanStatusTag(loan)}</td>
                          </tr>
                        `;
                      })
                      .join("")
                  : `
                    <tr>
                      <td colspan="4">${renderInlineEmpty("No active books on your account.")}</td>
                    </tr>
                  `
              }
            </tbody>
          </table>
        </div>
      </div>
      <div class="content-card">
        <div class="panel-head">
          <div>
            <h3 class="panel-title">Borrowing history</h3>
            <p>Past and present records for your student account.</p>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Book</th>
                <th>Issued</th>
                <th>Returned</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${
                history.length
                  ? history
                      .map((loan) => {
                        const book = getBookById(loan.bookId);
                        return `
                          <tr>
                            <td>${escapeHtml(book ? book.title : "Unknown title")}</td>
                            <td>${escapeHtml(formatShortDate(loan.issuedOn))}</td>
                            <td>${loan.returnedOn ? escapeHtml(formatShortDate(loan.returnedOn)) : "-"}</td>
                            <td>${renderLoanStatusTag(loan)}</td>
                          </tr>
                        `;
                      })
                      .join("")
                  : `
                    <tr>
                      <td colspan="4">${renderInlineEmpty("No borrowing history yet.")}</td>
                    </tr>
                  `
              }
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

function renderAccountSection(user) {
  const activeLoans = user.role === "student" ? getStudentActiveLoans(user.id).length : getActiveLoans().length;
  return `
    <section class="account-grid">
      <div class="account-card">
        <h3>Account details</h3>
        <div class="detail-list">
          <div class="detail-row">
            <span>Name</span>
            <strong>${escapeHtml(user.name)}</strong>
          </div>
          <div class="detail-row">
            <span>Role</span>
            <strong>${escapeHtml(user.role)}</strong>
          </div>
          <div class="detail-row">
            <span>Login ID</span>
            <strong>${escapeHtml(user.loginId)}</strong>
          </div>
          <div class="detail-row">
            <span>Email</span>
            <strong>${escapeHtml(user.email || "Not added")}</strong>
          </div>
          ${
            user.role === "student"
              ? `
                <div class="detail-row">
                  <span>Department</span>
                  <strong>${escapeHtml(user.department)}</strong>
                </div>
                <div class="detail-row">
                  <span>Year</span>
                  <strong>${escapeHtml(user.year)}</strong>
                </div>
                <div class="detail-row">
                  <span>Contact</span>
                  <strong>${escapeHtml(user.contactNumber || "Not added")}</strong>
                </div>
              `
              : ""
          }
          <div class="detail-row">
            <span>Activity snapshot</span>
            <strong>${activeLoans} ${user.role === "student" ? "active books" : "active loans"}</strong>
          </div>
        </div>
      </div>
      ${
        user.role === "admin"
          ? `
            <div class="account-card">
              <h3>Edit admin profile</h3>
              <form id="profile-form" class="panel-form">
                <div class="form-row">
                  <div class="form-field">
                    <label for="admin-name">Admin name</label>
                    <input id="admin-name" name="name" type="text" minlength="2" maxlength="60" value="${escapeHtml(user.name)}" required />
                  </div>
                  <div class="form-field">
                    <label for="admin-login-id">Username / Login ID</label>
                    <input id="admin-login-id" name="loginId" type="text" minlength="4" maxlength="40" value="${escapeHtml(user.loginId)}" required />
                  </div>
                </div>
                <div class="form-field">
                  <label for="admin-email">Admin email</label>
                  <input id="admin-email" name="email" type="email" value="${escapeHtml(user.email || "")}" required />
                  <p class="helper-text">Update how the admin account appears across the dashboard and login panel.</p>
                </div>
                <div class="form-field">
                  <label for="college-name">College name</label>
                  <input
                    id="college-name"
                    name="collegeName"
                    type="text"
                    minlength="3"
                    maxlength="120"
                    value="${escapeHtml(getSettings().siteName)}"
                    required
                  />
                  <p class="helper-text">This updates the college branding across the admin panel, student panel, library cards, and login page.</p>
                </div>
                <div class="panel-actions">
                  <button class="primary-button" type="submit">Save admin profile</button>
                </div>
              </form>
            </div>
          `
          : ""
      }
      ${
        user.role === "student"
          ? `
            <div class="account-card student-card-shell">
              <h3>Digital library card</h3>
              <p class="helper-text">Use this card on screen or export it through the browser's Save as PDF action.</p>
              ${renderStudentLibraryCard(user, { showActions: true, actionId: user.id, selfCard: true })}
            </div>
          `
          : ""
      }
      <div class="account-card">
        <h3>Change password</h3>
        <form id="password-form" class="panel-form">
          <div class="form-field">
            <label for="current-password">Current password</label>
            <input id="current-password" name="currentPassword" type="password" required />
          </div>
          <div class="form-field">
            <label for="new-password">New password</label>
            <input id="new-password" name="newPassword" type="password" minlength="6" required />
          </div>
          <div class="form-field">
            <label for="confirm-password">Confirm new password</label>
            <input id="confirm-password" name="confirmPassword" type="password" minlength="6" required />
          </div>
          <div class="panel-actions">
            <button class="primary-button" type="submit">Update password</button>
          </div>
        </form>
      </div>
    </section>
  `;
}

function renderStudentLibraryCard(student, options = {}) {
  const activeLoans = getStudentActiveLoans(student.id).length;
  const qrUrl = getStudentQrUrl(student);
  const cardId = getStudentCardId(student);
  const showActions = Boolean(options.showActions);
  const actionId = options.actionId || student.id;
  const footerNote = options.selfCard
    ? "Keep this digital card ready when visiting the library desk."
    : "Preview card for printing or digital sharing.";

  return `
    <div class="library-card-wrap">
      <article class="student-library-card" data-student-card="${escapeHtml(actionId)}">
        <div class="student-card-header">
          <div>
            <span class="tag info">Student Library Card</span>
            <h3>${escapeHtml(getSettings().siteName)}</h3>
            <p>${escapeHtml(getSettings().siteSubtitle)}</p>
          </div>
          <div class="student-card-avatar">${escapeHtml(getInitials(student.name))}</div>
        </div>
        <div class="student-card-body">
          <div class="student-card-details">
            <div class="detail-row">
              <span>Student name</span>
              <strong>${escapeHtml(student.name)}</strong>
            </div>
            <div class="detail-row">
              <span>Card ID</span>
              <strong>${escapeHtml(cardId)}</strong>
            </div>
            <div class="detail-row">
              <span>Username</span>
              <strong>${escapeHtml(student.loginId)}</strong>
            </div>
            <div class="detail-row">
              <span>Email</span>
              <strong>${escapeHtml(student.email)}</strong>
            </div>
            <div class="detail-row">
              <span>Contact</span>
              <strong>${escapeHtml(student.contactNumber || "Not added")}</strong>
            </div>
            <div class="detail-row">
              <span>Department</span>
              <strong>${escapeHtml(student.department)}</strong>
            </div>
            <div class="detail-row">
              <span>Year / Section</span>
              <strong>${escapeHtml(student.year)}</strong>
            </div>
            <div class="detail-row">
              <span>Active books</span>
              <strong>${activeLoans}</strong>
            </div>
          </div>
          <div class="student-card-qr">
            <img src="${escapeHtml(qrUrl)}" alt="QR code for ${escapeHtml(student.name)}" loading="lazy" />
            <span>Scan to verify library card identity.</span>
          </div>
        </div>
        <div class="student-card-footer">
          <span>${escapeHtml(footerNote)}</span>
          <strong>${escapeHtml(getSettings().siteName)}</strong>
        </div>
      </article>
      ${
        showActions
          ? `
            <div class="panel-actions">
              <button class="primary-button" type="button" data-action="${options.selfCard ? "download-my-card" : "download-student-card"}" data-id="${escapeHtml(actionId)}">
                Save card as PDF
              </button>
            </div>
          `
          : ""
      }
    </div>
  `;
}

function renderMetricCard(label, value, note) {
  return `
    <div class="metric-card">
      <span class="metric-label">${escapeHtml(label)}</span>
      <span class="metric-value">${escapeHtml(String(value))}</span>
      <div class="metric-note">${escapeHtml(note)}</div>
    </div>
  `;
}

function renderCataloguePreview() {
  const previewBooks = getBooks()
    .filter((book) => getAvailableCopies(book.id) > 0)
    .sort((a, b) => a.title.localeCompare(b.title))
    .slice(0, 4);

  if (!previewBooks.length) {
    return renderEmptyState("No available titles", "Every copy is currently issued out.");
  }

  return `
    <div class="catalog-grid">
      ${previewBooks
        .map(
          (book) => `
            <article class="catalog-card">
              <div>
                <h3>${escapeHtml(book.title)}</h3>
                <div class="catalog-meta">
                  <span>${escapeHtml(book.author)}</span>
                  <span>${escapeHtml(book.category)}</span>
                </div>
              </div>
              <div class="catalog-footer">
                ${renderAvailabilityTag(book.id)}
                <div class="helper-text">Shelf ${escapeHtml(book.shelf)}</div>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderActivityList(activities) {
  if (!activities.length) {
    return renderEmptyState("Nothing logged yet", "New catalogue changes and issue activity will show up here.");
  }

  return `
    <div class="activity-list">
      ${activities
        .map(
          (activity) => `
            <div class="activity-item">
              <span class="activity-dot ${escapeHtml(activity.tone)}"></span>
              <div class="activity-copy">
                <strong>${escapeHtml(activity.message)}</strong>
                <p>${escapeHtml(formatLongDate(activity.createdAt))}</p>
              </div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderAvailabilityTag(bookId) {
  const available = getAvailableCopies(bookId);
  const tone = available === 0 ? "unavailable" : available <= 1 ? "low" : "available";
  const label = available === 0 ? "Fully issued" : available <= 1 ? "Low stock" : "Available";
  return `<span class="tag ${tone}">${escapeHtml(label)}</span>`;
}

function renderLoanStatusTag(loan) {
  if (loan.returnedOn) {
    return `<span class="tag returned">Returned</span>`;
  }
  if (isOverdue(loan)) {
    return `<span class="tag overdue">Overdue</span>`;
  }
  if (isDueSoon(loan)) {
    return `<span class="tag due">Due soon</span>`;
  }
  return `<span class="tag info">On loan</span>`;
}

function renderEmptyState(title, description) {
  return `
    <div class="empty-state">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(description)}</span>
    </div>
  `;
}

function renderInlineEmpty(message) {
  return `<span class="muted">${escapeHtml(message)}</span>`;
}
function loginUser(form) {
  const formData = new FormData(form);
  const role = normalizeText(formData.get("role"));
  const loginId = normalizeText(formData.get("loginId"));
  const password = String(formData.get("password") || "").trim();
  const user = state.users.find(
    (entry) =>
      entry.role === role &&
      entry.loginId.toLowerCase() === loginId.toLowerCase() &&
      entry.password === password
  );

  if (!user) {
    flashMessage("error", "Login failed. Check the panel, login ID, and password.");
    renderApp();
    return;
  }

  session = {
    userId: user.id,
    loggedInAt: new Date().toISOString(),
  };
  saveSession();
  clearEditingState();
  viewState.section = "dashboard";
  flashMessage("success", `Welcome back, ${user.name.split(" ")[0]}.`);
  renderApp();
}

function saveBook(form) {
  if (!isAdmin()) {
    return;
  }

  const formData = new FormData(form);
  const bookId = normalizeText(formData.get("bookId"));
  const title = normalizeText(formData.get("title"));
  const author = normalizeText(formData.get("author"));
  const category = normalizeText(formData.get("category"));
  const isbn = normalizeText(formData.get("isbn"));
  const shelf = normalizeText(formData.get("shelf"));
  const totalCopies = Number(formData.get("totalCopies"));

  if (!title || !author || !category || !isbn || !shelf || !Number.isInteger(totalCopies) || totalCopies < 1) {
    flashMessage("error", "Please complete every book field with valid values.");
    renderApp();
    return;
  }

  const duplicateIsbn = state.books.find(
    (book) => book.isbn.toLowerCase() === isbn.toLowerCase() && book.id !== bookId
  );
  if (duplicateIsbn) {
    flashMessage("error", "That ISBN already exists in the catalogue.");
    renderApp();
    return;
  }

  if (bookId) {
    const book = getBookById(bookId);
    if (!book) {
      flashMessage("error", "That book record could not be found.");
      renderApp();
      return;
    }

    const activeCount = getActiveLoans().filter((loan) => loan.bookId === book.id).length;
    if (totalCopies < activeCount) {
      flashMessage("error", `Total copies cannot go below ${activeCount} while copies are still issued.`);
      renderApp();
      return;
    }

    book.title = title;
    book.author = author;
    book.category = category;
    book.isbn = isbn;
    book.shelf = shelf;
    book.totalCopies = totalCopies;
    pushActivity(`Updated book "${title}".`, "info");
    flashMessage("success", "Book details updated.");
  } else {
    state.books.push({
      id: createId("book"),
      title,
      author,
      category,
      isbn,
      shelf,
      totalCopies,
      createdAt: new Date().toISOString(),
    });
    pushActivity(`Added "${title}" to the catalogue.`, "success");
    flashMessage("success", "Book added to the catalogue.");
  }

  persistState();
  viewState.editingBookId = null;
  form.reset();
  renderApp();
}

function deleteBook(bookId) {
  if (!isAdmin()) {
    return;
  }

  const book = getBookById(bookId);
  if (!book) {
    return;
  }

  const hasHistory = state.loans.some((loan) => loan.bookId === bookId);
  if (hasHistory) {
    flashMessage("error", "This book has circulation history and cannot be deleted.");
    renderApp();
    return;
  }

  if (!window.confirm(`Delete "${book.title}" from the catalogue?`)) {
    return;
  }

  state.books = state.books.filter((entry) => entry.id !== bookId);
  pushActivity(`Deleted "${book.title}" from the catalogue.`, "warning");
  persistState();
  if (viewState.editingBookId === bookId) {
    viewState.editingBookId = null;
  }
  flashMessage("success", "Book deleted.");
  renderApp();
}

function saveStudent(form) {
  if (!isAdmin()) {
    return;
  }

  const formData = new FormData(form);
  const studentId = normalizeText(formData.get("studentId"));
  const name = normalizeText(formData.get("name"));
  const loginId = normalizeText(formData.get("loginId"));
  const department = normalizeText(formData.get("department"));
  const year = normalizeText(formData.get("year"));
  const email = normalizeText(formData.get("email"));
  const contactNumber = normalizeText(formData.get("contactNumber"));
  const password = String(formData.get("password") || "").trim();

  if (!name || !loginId || !department || !year || !email || !contactNumber) {
    flashMessage("error", "Please fill in all student details.");
    renderApp();
    return;
  }

  if (contactNumber.replace(/\D/g, "").length < 10) {
    flashMessage("error", "Student contact number must include at least 10 digits.");
    renderApp();
    return;
  }

  const duplicateLogin = state.users.find(
    (user) => user.loginId.toLowerCase() === loginId.toLowerCase() && user.id !== studentId
  );
  if (duplicateLogin) {
    flashMessage("error", "That login ID is already assigned to another user.");
    renderApp();
    return;
  }

  if (studentId) {
    const student = getUserById(studentId);
    if (!student || student.role !== "student") {
      flashMessage("error", "That student record could not be found.");
      renderApp();
      return;
    }

    student.name = name;
    student.loginId = loginId;
    student.department = department;
    student.year = year;
    student.email = email;
    student.contactNumber = contactNumber;
    if (password) {
      if (password.length < 6) {
        flashMessage("error", "New student passwords must be at least 6 characters.");
        renderApp();
        return;
      }
      student.password = password;
    }
    pushActivity(`Updated student account for ${name}.`, "info");
    flashMessage("success", "Student account updated.");
  } else {
    if (password.length < 6) {
      flashMessage("error", "Student passwords must be at least 6 characters.");
      renderApp();
      return;
    }

    state.users.push({
      id: createId("user"),
      role: "student",
      name,
      loginId,
      password,
      department,
      year,
      email,
      contactNumber,
      createdAt: new Date().toISOString(),
    });
    pushActivity(`Created student login "${loginId}" for ${name}.`, "success");
    flashMessage("success", "Student account created.");
  }

  persistState();
  viewState.editingStudentId = null;
  form.reset();
  renderApp();
}

function deleteStudent(studentId) {
  if (!isAdmin()) {
    return;
  }

  const student = getUserById(studentId);
  if (!student || student.role !== "student") {
    return;
  }

  const hasHistory = state.loans.some((loan) => loan.studentId === studentId);
  if (hasHistory) {
    flashMessage("error", "This student has borrowing history and cannot be deleted.");
    renderApp();
    return;
  }

  if (!window.confirm(`Delete student account "${student.name}"?`)) {
    return;
  }

  state.users = state.users.filter((entry) => entry.id !== studentId);
  pushActivity(`Deleted student account "${student.loginId}".`, "warning");
  persistState();
  if (viewState.editingStudentId === studentId) {
    viewState.editingStudentId = null;
  }
  flashMessage("success", "Student account deleted.");
  renderApp();
}

function issueBook(form) {
  if (!isAdmin()) {
    return;
  }

  const formData = new FormData(form);
  const studentId = normalizeText(formData.get("studentId"));
  const bookId = normalizeText(formData.get("bookId"));
  const issuedOn = normalizeText(formData.get("issuedOn"));
  const dueOn = normalizeText(formData.get("dueOn"));
  const student = getUserById(studentId);
  const book = getBookById(bookId);

  if (!student || student.role !== "student" || !book) {
    flashMessage("error", "Select a valid student and book.");
    renderApp();
    return;
  }

  if (!issuedOn || !dueOn || new Date(dueOn) <= new Date(issuedOn)) {
    flashMessage("error", "Due date must be later than the issued date.");
    renderApp();
    return;
  }

  if (getAvailableCopies(bookId) <= 0) {
    flashMessage("error", "That title is no longer available.");
    renderApp();
    return;
  }

  const duplicateLoan = getActiveLoans().find((loan) => loan.bookId === bookId && loan.studentId === studentId);
  if (duplicateLoan) {
    flashMessage("error", "This student already has that book issued.");
    renderApp();
    return;
  }

  state.loans.push({
    id: createId("loan"),
    bookId,
    studentId,
    issuedOn,
    dueOn,
    returnedOn: null,
    createdAt: new Date().toISOString(),
  });
  pushActivity(`Issued "${book.title}" to ${student.name}.`, "success");
  persistState();
  form.reset();
  const issuedField = form.querySelector("#issued-on");
  const dueField = form.querySelector("#due-on");
  if (issuedField) {
    issuedField.value = todayISO();
  }
  if (dueField) {
    dueField.value = offsetISO(getDefaultLoanDays());
  }
  flashMessage("success", "Book issued successfully.");
  renderApp();
}

function returnLoan(loanId) {
  if (!isAdmin()) {
    return;
  }

  const loan = state.loans.find((entry) => entry.id === loanId);
  if (!loan || loan.returnedOn) {
    return;
  }

  const book = getBookById(loan.bookId);
  const student = getUserById(loan.studentId);
  loan.returnedOn = todayISO();
  pushActivity(`Returned "${book ? book.title : "book"}" from ${student ? student.name : "student"}.`, "info");
  persistState();
  flashMessage("success", "Return recorded.");
  renderApp();
}

function updateProfile(form) {
  const user = getCurrentUser();
  if (!user || user.role !== "admin") {
    return;
  }

  const formData = new FormData(form);
  const nextName = normalizeText(formData.get("name"));
  const nextLoginId = normalizeText(formData.get("loginId"));
  const nextEmail = normalizeText(formData.get("email"));
  const nextCollegeName = normalizeText(formData.get("collegeName"));

  if (nextName.length < 2) {
    flashMessage("error", "Admin name must be at least 2 characters.");
    renderApp();
    return;
  }

  if (nextLoginId.length < 4) {
    flashMessage("error", "Admin username must be at least 4 characters.");
    renderApp();
    return;
  }

  if (!nextEmail || !nextEmail.includes("@")) {
    flashMessage("error", "Please enter a valid admin email address.");
    renderApp();
    return;
  }

  if (nextCollegeName.length < 3) {
    flashMessage("error", "College name must be at least 3 characters.");
    renderApp();
    return;
  }

  const duplicateLogin = state.users.find(
    (entry) => entry.loginId.toLowerCase() === nextLoginId.toLowerCase() && entry.id !== user.id
  );
  if (duplicateLogin) {
    flashMessage("error", "That username/login ID is already assigned to another user.");
    renderApp();
    return;
  }

  if (
    nextName === user.name &&
    nextLoginId === user.loginId &&
    nextEmail === user.email &&
    nextCollegeName === getSettings().siteName
  ) {
    flashMessage("info", "The admin profile is already up to date.");
    renderApp();
    return;
  }

  const previousName = user.name;
  const previousLoginId = user.loginId;
  const previousCollegeName = getSettings().siteName;
  user.name = nextName;
  user.loginId = nextLoginId;
  user.email = nextEmail;
  state.settings = {
    ...getSettings(),
    ...createSiteBranding(nextCollegeName),
  };
  const activityMessage =
    previousCollegeName === nextCollegeName
      ? `Admin profile updated from ${previousName} (${previousLoginId}) to ${nextName} (${nextLoginId}).`
      : `Admin profile updated from ${previousName} (${previousLoginId}) to ${nextName} (${nextLoginId}), and college branding changed from ${previousCollegeName} to ${nextCollegeName}.`;
  pushActivity(activityMessage, "info");
  persistState();
  flashMessage("success", "Admin profile updated.");
  renderApp();
}

function exportStudentCardPdf(studentId) {
  const student = getUserById(studentId);
  if (!student || student.role !== "student") {
    flashMessage("error", "Student card data could not be found.");
    renderApp();
    return;
  }

  const printWindow = window.open("", "_blank", "width=960,height=720");
  if (!printWindow) {
    flashMessage("error", "Popup blocked. Please allow popups to save the card as PDF.");
    renderApp();
    return;
  }

  printWindow.document.open();
  printWindow.document.write(renderStudentCardPrintDocument(student));
  printWindow.document.close();
}

function updatePassword(form) {
  const user = getCurrentUser();
  if (!user) {
    return;
  }

  const formData = new FormData(form);
  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (currentPassword !== user.password) {
    flashMessage("error", "Your current password does not match.");
    renderApp();
    return;
  }

  if (newPassword.length < 6) {
    flashMessage("error", "New passwords must be at least 6 characters.");
    renderApp();
    return;
  }

  if (newPassword !== confirmPassword) {
    flashMessage("error", "The new passwords do not match.");
    renderApp();
    return;
  }

  user.password = newPassword;
  pushActivity(`${user.name} updated their password.`, "info");
  persistState();
  form.reset();
  flashMessage("success", "Password updated.");
  renderApp();
}

function fillDemoCredentials(role, loginId, password) {
  const roleField = document.getElementById("login-role");
  const idField = document.getElementById("login-id");
  const passwordField = document.getElementById("login-password");
  if (!roleField || !idField || !passwordField) {
    return;
  }
  roleField.value = role;
  idField.value = loginId;
  passwordField.value = password;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : createSeedState();
    const hydrated = hydrateState(parsed);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hydrated));
    return hydrated;
  } catch (error) {
    const seeded = hydrateState(createSeedState());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function saveSession() {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function syncSession() {
  if (!session) {
    return;
  }
  const user = getUserById(session.userId);
  if (!user) {
    session = null;
    clearSession();
    return;
  }
  if (!getNavItems(user.role).some((item) => item.key === viewState.section)) {
    viewState.section = "dashboard";
  }
}

function createSiteBranding(siteName) {
  const cleanName = normalizeText(siteName) || "ABS Academy Of Management and Health Science";
  const displayName = cleanName.length > 48 ? cleanName : cleanName;
  return {
    siteName: cleanName,
    siteSubtitle: "Library Management Portal",
    creatorName: "Animesh Karmakar",
    sidebarDescription: "Official digital library workspace for catalogue control, circulation, and student access.",
    loginEyebrow: `${displayName} digital library`,
    loginHeadline: `A smarter library experience for ${displayName}.`,
    loginDescription: `Manage books, track circulation, and support student logins through the official ${displayName} library portal.`,
    announcement: `Welcome to the official library portal of ${displayName}.`,
  };
}

function createDefaultSettings() {
  return {
    ...createSiteBranding("ABS Academy Of Management and Health Science"),
    defaultLoanDays: DEFAULT_LOAN_DAYS,
    dueSoonDays: DEFAULT_DUE_WINDOW_DAYS,
  };
}

function hydrateState(rawState) {
  const seeded = createSeedState();
  const source = rawState && typeof rawState === "object" ? rawState : {};
  return {
    version: DATA_VERSION,
    users: Array.isArray(source.users) ? source.users : seeded.users,
    books: Array.isArray(source.books) ? source.books : seeded.books,
    loans: Array.isArray(source.loans) ? source.loans : seeded.loans,
    activities: Array.isArray(source.activities) ? source.activities : seeded.activities,
    settings: {
      ...createDefaultSettings(),
      ...(source.settings || {}),
    },
  };
}

function createSeedState() {
  const adminId = "user-admin-1";
  const studentOneId = "user-student-1";
  const studentTwoId = "user-student-2";
  const studentThreeId = "user-student-3";
  const books = [
    {
      id: "book-1",
      title: "Clean Code",
      author: "Robert C. Martin",
      category: "Programming",
      isbn: "9780132350884",
      shelf: "A-01",
      totalCopies: 4,
      createdAt: timestampOffset(-32),
    },
    {
      id: "book-2",
      title: "Introduction to Algorithms",
      author: "Thomas H. Cormen",
      category: "Computer Science",
      isbn: "9780262046305",
      shelf: "A-02",
      totalCopies: 3,
      createdAt: timestampOffset(-28),
    },
    {
      id: "book-3",
      title: "The Pragmatic Programmer",
      author: "Andrew Hunt",
      category: "Software Engineering",
      isbn: "9780135957059",
      shelf: "A-04",
      totalCopies: 2,
      createdAt: timestampOffset(-22),
    },
    {
      id: "book-4",
      title: "Atomic Habits",
      author: "James Clear",
      category: "Self Improvement",
      isbn: "9780735211292",
      shelf: "B-10",
      totalCopies: 5,
      createdAt: timestampOffset(-18),
    },
    {
      id: "book-5",
      title: "Database System Concepts",
      author: "Abraham Silberschatz",
      category: "Databases",
      isbn: "9780078022159",
      shelf: "A-06",
      totalCopies: 2,
      createdAt: timestampOffset(-14),
    },
    {
      id: "book-6",
      title: "Deep Work",
      author: "Cal Newport",
      category: "Productivity",
      isbn: "9781455586691",
      shelf: "B-12",
      totalCopies: 3,
      createdAt: timestampOffset(-11),
    },
  ];

  return {
    version: DATA_VERSION,
    settings: createDefaultSettings(),
    users: [
      {
        id: adminId,
        role: "admin",
        name: "Aarav Mehta",
        loginId: "admin01",
        password: "Admin@123",
        email: "admin@librarynexus.local",
        createdAt: timestampOffset(-40),
      },
      {
        id: studentOneId,
        role: "student",
        name: "Riya Sharma",
        loginId: "STU1001",
        password: "Student@123",
        department: "Computer Science",
        year: "2nd Year",
        email: "riya.sharma@example.edu",
        contactNumber: "9876543210",
        createdAt: timestampOffset(-30),
      },
      {
        id: studentTwoId,
        role: "student",
        name: "Kabir Nair",
        loginId: "STU1002",
        password: "Student@123",
        department: "Information Technology",
        year: "3rd Year",
        email: "kabir.nair@example.edu",
        contactNumber: "9123456780",
        createdAt: timestampOffset(-25),
      },
      {
        id: studentThreeId,
        role: "student",
        name: "Ishita Verma",
        loginId: "STU1003",
        password: "Student@123",
        department: "Electronics",
        year: "1st Year",
        email: "ishita.verma@example.edu",
        contactNumber: "9988776655",
        createdAt: timestampOffset(-18),
      },
    ],
    books,
    loans: [
      {
        id: "loan-1",
        bookId: "book-1",
        studentId: studentOneId,
        issuedOn: offsetISO(-5),
        dueOn: offsetISO(5),
        returnedOn: null,
        createdAt: timestampOffset(-5),
      },
      {
        id: "loan-2",
        bookId: "book-3",
        studentId: studentTwoId,
        issuedOn: offsetISO(-12),
        dueOn: offsetISO(-2),
        returnedOn: null,
        createdAt: timestampOffset(-12),
      },
      {
        id: "loan-3",
        bookId: "book-5",
        studentId: studentOneId,
        issuedOn: offsetISO(-24),
        dueOn: offsetISO(-10),
        returnedOn: offsetISO(-9),
        createdAt: timestampOffset(-24),
      },
    ],
    activities: [
      {
        id: "activity-1",
        message: `Created admin login "admin01".`,
        tone: "success",
        createdAt: timestampOffset(-40),
      },
      {
        id: "activity-2",
        message: `Seeded ${books.length} catalogue titles for the first launch.`,
        tone: "info",
        createdAt: timestampOffset(-35),
      },
      {
        id: "activity-3",
        message: `Issued "Clean Code" to Riya Sharma.`,
        tone: "success",
        createdAt: timestampOffset(-5),
      },
      {
        id: "activity-4",
        message: `Issued "The Pragmatic Programmer" to Kabir Nair.`,
        tone: "warning",
        createdAt: timestampOffset(-12),
      },
      {
        id: "activity-5",
        message: `Returned "Database System Concepts" from Riya Sharma.`,
        tone: "info",
        createdAt: timestampOffset(-9),
      },
    ],
  };
}

function getNavItems(role) {
  if (role === "admin") {
    return [
      { key: "dashboard", label: "Dashboard" },
      { key: "books", label: "Books" },
      { key: "students", label: "Students" },
      { key: "circulation", label: "Issue / Return" },
      { key: "activity", label: "Activity" },
      { key: "account", label: "Account" },
    ];
  }

  return [
    { key: "dashboard", label: "Dashboard" },
    { key: "catalogue", label: "Catalogue" },
    { key: "my-books", label: "My Books" },
    { key: "account", label: "Account" },
  ];
}

function getSectionMeta(role, key) {
  const copy = {
    admin: {
      dashboard: {
        title: "Admin dashboard",
        description: "Monitor stock, active circulation, and the student login base at a glance.",
      },
      books: {
        title: "Books",
        description: "Add, edit, and maintain the catalogue with copy counts and shelf locations.",
      },
      students: {
        title: "Students",
        description: "Create and manage student logins with their own ID and password.",
      },
      circulation: {
        title: "Issue and return",
        description: "Record loan activity, enforce due dates, and mark books as returned.",
      },
      activity: {
        title: "Activity log",
        description: "Review a running trail of the most recent catalogue and circulation changes.",
      },
      account: {
        title: "Account",
        description: "Review your admin profile and keep your password up to date.",
      },
    },
    student: {
      dashboard: {
        title: "Student dashboard",
        description: "Check your current books, due dates, and a quick snapshot of available titles.",
      },
      catalogue: {
        title: "Catalogue",
        description: "Browse the library collection and see which books are available right now.",
      },
      "my-books": {
        title: "My books",
        description: "View active loans and your borrowing history from one place.",
      },
      account: {
        title: "Account",
        description: "Review your student profile and change your login password when needed.",
      },
    },
  };

  return copy[role][key];
}

function getCurrentUser() {
  return session ? getUserById(session.userId) : null;
}

function getAdminUser() {
  return state.users.find((user) => user.role === "admin") || null;
}

function getSettings() {
  return {
    ...createDefaultSettings(),
    ...(state.settings || {}),
  };
}

function getDefaultLoanDays() {
  return Number(getSettings().defaultLoanDays) || DEFAULT_LOAN_DAYS;
}

function getDueSoonDays() {
  return Number(getSettings().dueSoonDays) || DEFAULT_DUE_WINDOW_DAYS;
}

function applySiteSettings() {
  document.title = `${getSettings().siteSubtitle} | ${getSettings().siteName}`;
}

function getBooks() {
  return state.books.slice();
}

function getStudents() {
  return state.users.filter((user) => user.role === "student");
}

function getInstitutionCode() {
  const collegeName = getSettings().siteName || "COLLEGE";
  const firstWord = String(collegeName).split(" ").find(Boolean) || "COLLEGE";
  return firstWord.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "COL";
}

function getStudentCardId(student) {
  return `${getInstitutionCode()}-LIB-${student.loginId}`;
}

function getStudentQrPayload(student) {
  return `${getInstitutionCode()}-LIB|${student.loginId}|${student.id}|${student.department}|${student.year}|${student.contactNumber || ""}`;
}

function getStudentQrUrl(student) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(getStudentQrPayload(student))}`;
}

function getBookById(bookId) {
  return state.books.find((book) => book.id === bookId) || null;
}

function getUserById(userId) {
  return state.users.find((user) => user.id === userId) || null;
}

function getActiveLoans() {
  return state.loans.filter((loan) => !loan.returnedOn);
}

function getStudentActiveLoans(studentId) {
  return getActiveLoans().filter((loan) => loan.studentId === studentId);
}

function getStudentLoanHistory(studentId) {
  return state.loans.filter((loan) => loan.studentId === studentId);
}

function getOverdueLoans() {
  return getActiveLoans().filter((loan) => isOverdue(loan));
}

function getAvailableCopies(bookId) {
  const book = getBookById(bookId);
  if (!book) {
    return 0;
  }
  const activeCount = getActiveLoans().filter((loan) => loan.bookId === bookId).length;
  return Math.max(book.totalCopies - activeCount, 0);
}

function getRecentActivities(limit) {
  return state.activities
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

function pushActivity(message, tone) {
  state.activities.push({
    id: createId("activity"),
    message,
    tone,
    createdAt: new Date().toISOString(),
  });
}

function matchesBookSearch(book, query) {
  const input = query.trim().toLowerCase();
  if (!input) {
    return true;
  }
  return [book.title, book.author, book.category, book.isbn].some((value) =>
    value.toLowerCase().includes(input)
  );
}

function matchesStudentSearch(student, query) {
  const input = query.trim().toLowerCase();
  if (!input) {
    return true;
  }
  return [student.name, student.loginId, student.department, student.email, student.contactNumber || ""].some((value) =>
    String(value).toLowerCase().includes(input)
  );
}

function isOverdue(loan) {
  if (loan.returnedOn) {
    return false;
  }
  return stripTime(new Date(loan.dueOn)) < stripTime(new Date());
}

function isDueSoon(loan) {
  if (loan.returnedOn || isOverdue(loan)) {
    return false;
  }
  const diffDays = Math.ceil((stripTime(new Date(loan.dueOn)) - stripTime(new Date())) / 86400000);
  return diffDays <= getDueSoonDays();
}

function isAdmin() {
  const user = getCurrentUser();
  return Boolean(user && user.role === "admin");
}

function clearEditingState() {
  viewState.editingBookId = null;
  viewState.editingStudentId = null;
  viewState.selectedCardStudentId = null;
}

function flashMessage(type, message) {
  flash = { type, message };
}

function normalizeText(value) {
  return String(value || "").trim();
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getInitials(name) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function renderStudentCardPrintDocument(student) {
  const qrUrl = getStudentQrUrl(student);
  const cardId = getStudentCardId(student);
  const activeLoans = getStudentActiveLoans(student.id).length;

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(student.name)} Library Card</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 24px;
            font-family: "Segoe UI", Verdana, sans-serif;
            background: linear-gradient(145deg, #f8f1e2 0%, #ebe0c9 45%, #f4ebdc 100%);
            color: #1e2726;
          }
          .print-shell {
            width: 100%;
            max-width: 860px;
          }
          .print-note {
            margin: 0 0 16px;
            color: #17514d;
            text-align: center;
            font-weight: 700;
          }
          .card {
            background: linear-gradient(160deg, #123c3b, #1d5b58);
            color: #f8f4ea;
            border-radius: 28px;
            padding: 28px;
            box-shadow: 0 24px 70px rgba(33, 40, 39, 0.16);
          }
          .card-header,
          .card-body {
            display: flex;
            justify-content: space-between;
            gap: 24px;
          }
          .card-header {
            align-items: center;
            margin-bottom: 20px;
          }
          .card-tag {
            display: inline-flex;
            padding: 8px 12px;
            border-radius: 999px;
            background: rgba(216, 143, 45, 0.18);
            color: #f8dfb5;
            font-size: 12px;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            font-weight: 800;
          }
          .card h1 {
            margin: 14px 0 6px;
            font-size: 30px;
            line-height: 1.15;
          }
          .card p {
            margin: 0;
            color: rgba(248, 244, 234, 0.84);
          }
          .avatar {
            width: 88px;
            height: 88px;
            border-radius: 24px;
            display: grid;
            place-items: center;
            background: rgba(255,255,255,0.14);
            font-size: 32px;
            font-weight: 800;
          }
          .details {
            flex: 1;
            display: grid;
            gap: 12px;
          }
          .row {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            padding-bottom: 10px;
            border-bottom: 1px dashed rgba(255,255,255,0.2);
          }
          .row span { color: rgba(248, 244, 234, 0.78); }
          .row strong { text-align: right; }
          .qr {
            width: 240px;
            flex: 0 0 240px;
            border-radius: 24px;
            padding: 18px;
            background: rgba(255,255,255,0.12);
            text-align: center;
          }
          .qr img {
            width: 100%;
            display: block;
            background: #fff;
            border-radius: 16px;
            padding: 10px;
          }
          .qr span {
            display: block;
            margin-top: 12px;
            color: rgba(248, 244, 234, 0.82);
            font-size: 13px;
          }
          .footer {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            margin-top: 20px;
            font-size: 13px;
            color: rgba(248, 244, 234, 0.88);
          }
          @media print {
            body {
              background: #ffffff;
              padding: 0;
            }
            .print-note { display: none; }
            .card {
              box-shadow: none;
              break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-shell">
          <p class="print-note">Choose "Save as PDF" in your browser print dialog to export this library card.</p>
          <article class="card">
            <div class="card-header">
              <div>
                <span class="card-tag">Student Library Card</span>
                <h1>${escapeHtml(getSettings().siteName)}</h1>
                <p>${escapeHtml(getSettings().siteSubtitle)}</p>
              </div>
              <div class="avatar">${escapeHtml(getInitials(student.name))}</div>
            </div>
            <div class="card-body">
              <div class="details">
                <div class="row"><span>Student name</span><strong>${escapeHtml(student.name)}</strong></div>
                <div class="row"><span>Card ID</span><strong>${escapeHtml(cardId)}</strong></div>
                <div class="row"><span>Username</span><strong>${escapeHtml(student.loginId)}</strong></div>
                <div class="row"><span>Email</span><strong>${escapeHtml(student.email)}</strong></div>
                <div class="row"><span>Contact</span><strong>${escapeHtml(student.contactNumber || "Not added")}</strong></div>
                <div class="row"><span>Department</span><strong>${escapeHtml(student.department)}</strong></div>
                <div class="row"><span>Year / Section</span><strong>${escapeHtml(student.year)}</strong></div>
                <div class="row"><span>Active books</span><strong>${activeLoans}</strong></div>
              </div>
              <div class="qr">
                <img src="${escapeHtml(qrUrl)}" alt="QR code for ${escapeHtml(student.name)}" />
                <span>Scan to verify card identity.</span>
              </div>
            </div>
            <div class="footer">
              <span>Made by ${escapeHtml(getSettings().creatorName)}</span>
              <strong>${escapeHtml(getSettings().siteName)}</strong>
            </div>
          </article>
        </div>
        <script>
          window.addEventListener("load", function () {
            var img = document.querySelector(".qr img");
            var trigger = function () { setTimeout(function () { window.print(); }, 250); };
            if (!img) { trigger(); return; }
            if (img.complete) { trigger(); return; }
            img.addEventListener("load", trigger, { once: true });
            img.addEventListener("error", trigger, { once: true });
          });
        </script>
      </body>
    </html>
  `;
}

function todayISO() {
  return formatISODate(new Date());
}

function offsetISO(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatISODate(date);
}

function timestampOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function formatISODate(date) {
  const local = new Date(date);
  const year = local.getFullYear();
  const month = String(local.getMonth() + 1).padStart(2, "0");
  const day = String(local.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function stripTime(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatShortDate(value) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatLongDate(value) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

