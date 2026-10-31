(() => {
  let active = null;

  function setActive(author) {
    active = author;
    document.querySelectorAll(".author-filter").forEach((el) => {
      el.classList.toggle("is-active", author !== null && el.dataset.author === author);
    });
    document.querySelectorAll(".cal-item").forEach((item) => {
      const authors = (item.dataset.authors || "").split("|").filter(Boolean);
      const show = author === null || authors.includes(author);
      item.classList.toggle("is-hidden", !show);
    });
    document.querySelectorAll(".week-block").forEach((week) => {
      const visible = week.querySelectorAll(".cal-item:not(.is-hidden)").length > 0;
      week.classList.toggle("is-hidden", !visible);
    });
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".author-filter");
    if (!btn) return;
    e.preventDefault();
    const author = btn.dataset.author || null;
    setActive(active === author ? null : author);
  });
})();
