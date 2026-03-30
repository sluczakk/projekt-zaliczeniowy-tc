import { useNavigate } from "react-router-dom";
import "./Dashboard.css";

import { useState, useEffect } from "react";

import API_BASE_URL from "../config";

function Dashboard({ user }) 
{
  // pobieramy zapisane taski
  useEffect(() => {
    const token = localStorage.getItem("token");

    async function loadTasks() {
      try {
        const res = await fetch(`${API_BASE_URL}/tasks`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error("Nie udalo sie pobrac taskow");
        }

        const data = await res.json();
        setTasks(data.tasks);
      } catch (err) {
        console.error(err);
      }
    }

    loadTasks();
  }, []);

  // token wysylany do weryfikacji tozsamosci
  function getAuthHeaders(withJson = false) {
    const token = localStorage.getItem("token");

    return {
      ...(withJson ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
    };
  }

  // dodaj zadanie na backendzie
  async function createTask(taskData) {
    const res = await fetch(`${API_BASE_URL}/tasks`, {
      method: "POST",
      headers: getAuthHeaders(true),
      body: JSON.stringify(taskData),
    });

    if (!res.ok) {
      throw new Error("Nie udalo sie dodac taska");
    }

    const data = await res.json();
    return data.task;
  }

  // zaktualizuj zadanie na backendzzie
  async function updateTask(taskId, taskData) {
    const token = localStorage.getItem("token");

    const res = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(taskData),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Nie udało się zapisać zmian");
    }

    return data.task;
  }

  // usun zadanie na backendzie
  async function deleteTask(taskId) {
    const res = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      throw new Error("Nie udalo sie usunac taska");
    }
  }

  const navigate = useNavigate();

  // zadania uzytkownika
  const [tasks, setTasks] = useState([]);

  // pop-up: wybrane zadanie
  const [selectedTask, setSelectedTask] = useState(null);

  // pop-up z dodawaniem/modyfikowaniem zadania
  const [showModal, setShowModal] = useState(false);

  // dodawane zadanie
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    detailedDescription: "",
    priority: "medium",
    deadline: "",
    tags: "",
    progress: "todo",
  });

  // dodawanie nowego zadania
  async function handleAddTask(e) {
    e.preventDefault();

    const preparedTask = {
      title: newTask.title,
      description: newTask.description,
      detailedDescription: newTask.detailedDescription,
      priority: newTask.priority,
      deadline: newTask.deadline || "",
      tags: newTask.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag !== ""),
      progress: newTask.progress,
    };

    try {
      if (editingTaskId !== null) {
        const updatedTask = await updateTask(editingTaskId, preparedTask);

        setTasks((prev) =>
          prev.map((task) => (task.id === editingTaskId ? updatedTask : task))
        );

        if (selectedTask?.id === editingTaskId) {
          setSelectedTask(updatedTask);
        }
      } else {
        const createdTask = await createTask(preparedTask);
        setTasks((prev) => [...prev, createdTask]);
      }

      setNewTask({
        title: "",
        description: "",
        detailedDescription: "",
        priority: "medium",
        deadline: "",
        tags: "",
        progress: "todo",
      });

      setEditingTaskId(null);
      setShowModal(false);
    } catch (err) {
      console.error(err);
    }
  }

  // modyfikowanie zadania
  const [editingTaskId, setEditingTaskId] = useState(null);

  function handleEditTask(task) {
    setEditingTaskId(task.id);
    setNewTask({
      title: task.title || "",
      description: task.description || "",
      detailedDescription: task.detailedDescription || "",
      priority: task.priority || "medium",
      deadline: task.deadline || "",
      tags: task.tags ? task.tags.join(", ") : "",
      progress: task.progress || "todo",
    });
    setShowModal(true);
  }

  function handleInputChange(e) {
    const { name, value } = e.target;
    setNewTask((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  // wyszukiwarka
  const [searchTerm, setSearchTerm] = useState("");

  // wylogowywanie
  function handleLogout() {
    localStorage.removeItem("token");
    navigate("/");
    window.location.reload();
  }

  // filtrowanie, sortowanie wg progresu, priorytety
  const [sortBy, setSortBy] = useState("none");

  const [priorityFilters, setPriorityFilters] = useState({
    "very-high": true,
    "high": true,
    "medium": true,
    "low": true,
  });

  const priorityOrderHighToLow = {
    "very-high": 4,
    "high": 3,
    "medium": 2,
    "low": 1,
  };
  
  function handlePriorityFilterChange(priority) {
    setPriorityFilters((prev) => ({
      ...prev,
      [priority]: !prev[priority],
    }));
  }

  const [progressFilters, setProgressFilters] = useState({
    "todo": true,
    "in-progress": true,
    "done": false,
  });

  function handleProgressFilterChange(progress) {
    setProgressFilters((prev) => ({
      ...prev,
      [progress]: !prev[progress],
    }));
  }

  // pofiltrowane, posortowane zadania
  const visibleTasks = [...tasks]
    .filter(Boolean)
    .filter((task) => priorityFilters[task.priority])
    .filter((task) => progressFilters[task.progress])
    .filter((task) => {
      const q = searchTerm.trim().toLowerCase();
      if (!q) return true;

      return (
        task.title?.toLowerCase().includes(q) ||
        task.description?.toLowerCase().includes(q) ||
        task.detailedDescription?.toLowerCase().includes(q) ||
        task.priority?.toLowerCase().includes(q) ||
        task.progress?.toLowerCase().includes(q) ||
        task.deadline?.toLowerCase().includes(q) ||
        (task.tags || []).some((tag) => tag.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (sortBy === "deadline-newest") {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(b.deadline) - new Date(a.deadline);
      }

      if (sortBy === "deadline-oldest") {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
      }

      if (sortBy === "priority-highest") {
        return priorityOrderHighToLow[b.priority] - priorityOrderHighToLow[a.priority];
      }

      if (sortBy === "priority-lowest") {
        return priorityOrderHighToLow[a.priority] - priorityOrderHighToLow[b.priority];
      }

      return 0;
    });

  const priorityLabels = {
    "very-high": "bardzo wysoki",
    "high": "wysoki",
    "medium": "średni",
    "low": "niski",
  };

  const progressLabels = {
    "todo": "nierozpoczęte",
    "done": "zakończone",
    "in-progress": "w trakcie",
  };


  return (
    <div className="app">
			<header className="header">
        <div className="header-left">
          <h1 className="logo">Organizator zadań</h1>

            <div className="header-controls">
              <button
                className="add-task-btn"
                onClick={() => {
                  setEditingTaskId(null);
                  setNewTask({
                    title: "",
                    description: "",
                    detailedDescription: "",
                    priority: "medium",
                    deadline: "",
                    tags: "",
                    progress: "todo",
                  });
                  setShowModal(true);
                }}
              >
                Dodaj zadanie
              </button>

              <select
                className="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="none">Sortowanie</option>
                <option value="deadline-newest">Deadline: najdalsze</option>
                <option value="deadline-oldest">Deadline: najbliższe</option>
                <option value="priority-highest">Priorytet: najwyższy</option>
                <option value="priority-lowest">Priorytet: najniższy</option>
              </select>

              <input
                type="text"
                className="task-search-input"
                placeholder="Szukaj zadania..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="filters-panel">
              <div className="filter-group">
                <span className="filter-title">Priorytet</span>

                <label>
                  <input
                    type="checkbox"
                    checked={priorityFilters["very-high"]}
                    onChange={() => handlePriorityFilterChange("very-high")}
                  />
                  bardzo wysoki
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={priorityFilters["high"]}
                    onChange={() => handlePriorityFilterChange("high")}
                  />
                  wysoki
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={priorityFilters["medium"]}
                    onChange={() => handlePriorityFilterChange("medium")}
                  />
                  średni
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={priorityFilters["low"]}
                    onChange={() => handlePriorityFilterChange("low")}
                  />
                  niski
                </label>
              </div>

              <div className="filter-group">
                <span className="filter-title">Progres</span>

                <label>
                  <input
                    type="checkbox"
                    checked={progressFilters.todo}
                    onChange={() => handleProgressFilterChange("todo")}
                  />
                  Nierozpoczęte
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={progressFilters["in-progress"]}
                    onChange={() => handleProgressFilterChange("in-progress")}
                  />
                  W trakcie
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={progressFilters.done}
                    onChange={() => handleProgressFilterChange("done")}
                  />
                  Zakończone
                </label>
              </div>
            </div>
          
        </div>

        <div className="user-section">
          <span className="user-email">{user?.email}</span>
          <button className="logout-btn" onClick={handleLogout}>
            Wyloguj
          </button>
        </div>
      </header>

      <main>
        <div className="mainLayout">
          <div className="tasks-grid">
            {visibleTasks.filter(Boolean).map((task) => (
              <div
                key={task.id}
                className={`task-card ${task.priority}`}
                onClick={() => setSelectedTask(task)}
              >
                <div className="task-header">
                  <div className="task-header-top">
                    <span className={`badge badge-priority-${task.priority}`}>
                      {priorityLabels[task.priority]}
                    </span>
                  </div>

                  <h2 className="task-title">{task.title}</h2>
                </div>

                <p className="task-description">{task.description}</p>  

                <p className="task-deadline">Deadline: {task.deadline || "brak"}</p>

                <div className="task-tags">
                  {task.tags.map((tag, index) => (
                    <span key={index} className="task-tag">
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="task-card-footer">
                  <span className={`badge badge-progress-${task.progress}`}>
                    {progressLabels[task.progress]}
                  </span>

                  <div className="task-actions">
                   <button
                      className="delete-task-btn"
                      onClick={async (e) => {
                        e.stopPropagation();

                        try {
                          await deleteTask(task.id);
                          setTasks((prev) => prev.filter((t) => t.id !== task.id));

                          if (selectedTask?.id === task.id) {
                            setSelectedTask(null);
                          }
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                    >
                      Usuń
                    </button>
                    <button
                      className="edit-task-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditTask(task);
                      }}
                    >
                      Edytuj
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

   {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top">
              <h2>{editingTaskId !== null ? "Edytuj zadanie" : "Dodaj zadanie"}</h2>
              <button
                className="close-btn"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>

            <form className="task-form" onSubmit={handleAddTask}>
              <label>
                Tytuł
                <input
                  type="text"
                  name="title"
                  value={newTask.title}
                  onChange={handleInputChange}
                  required
                />
              </label>

              <label>
                Krótki opis
                <input
                  type="text"
                  name="description"
                  value={newTask.description}
                  onChange={handleInputChange}
                  required
                />
              </label>

              <label>
                Opis
                <textarea
                  name="detailedDescription"
                  value={newTask.detailedDescription}
                  onChange={handleInputChange}
                  rows="4"
                />
              </label>

              <label>
                Priorytet
                <select
                  name="priority"
                  value={newTask.priority}
                  onChange={handleInputChange}
                >
                  <option value="very-high">Bardzo wysoki</option>
                  <option value="high">Wysoki</option>
                  <option value="medium">Średni</option>
                  <option value="low">Niski</option>
                </select>
              </label>

              <label>
                Deadline
                <input
                  type="date"
                  name="deadline"
                  value={newTask.deadline}
                  onChange={handleInputChange}
                />
              </label>

              <label>
                Tagi
                <input
                  type="text"
                  name="tags"
                  value={newTask.tags}
                  onChange={handleInputChange}
                  placeholder="e.g. react, uni, urgent"
                />
              </label>

              <label>
                Progres
                <select
                  name="progress"
                  value={newTask.progress}
                  onChange={handleInputChange}
                >
                  <option value="todo">Nierozpoczęte</option>
                  <option value="in-progress">W trakcie</option>
                  <option value="done">Zakończone</option>
                </select>
              </label>

            <button type="submit" className="submit-task-btn">
              {editingTaskId !== null ? "Zapisz zmiany" : "Zapisz"}
            </button>
            </form>
          </div>
        </div>
      )}

    {selectedTask && (
      <div className="modal-overlay" onClick={() => setSelectedTask(null)}>
        <div className="modal task-preview-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-top">
            <h2>{selectedTask.title}</h2>
            <button className="close-btn" onClick={() => setSelectedTask(null)}>
              ✕
            </button>
          </div>

          <div className="task-preview-content">
            <p>
              <strong>Krótki opis:</strong> {selectedTask.description || "brak"}
            </p>

            <div>
              <strong>Opis:</strong>
              <p className="task-detailed-description">
                {selectedTask.detailedDescription || "brak"}
              </p>
            </div>

            <p>
              <strong>Priorytet:</strong> {priorityLabels[selectedTask.priority]}
            </p>

            <p>
              <strong>Progres:</strong> {progressLabels[selectedTask.progress]}
            </p>

            <p>
              <strong>Deadline:</strong> {selectedTask.deadline || "brak"}
            </p>

            <div className="task-preview-tags">
              <strong>Tagi:</strong>
              <div className="task-tags">
                {selectedTask.tags?.length > 0 ? (
                  selectedTask.tags.map((tag, index) => (
                    <span key={index} className="task-tag">
                      #{tag}
                    </span>
                  ))
                ) : (
                  <span className="no-tags">brak</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

    </div>
  );
}

export default Dashboard;