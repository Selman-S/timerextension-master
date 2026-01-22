// Timer Queue Manager - UI Components (Part 2/3)
// Event handlers and search functions

(() => {
  'use strict';

  // ============================================================================
  // UI MANAGER - PART 2: EVENTS & SEARCH
  // ============================================================================

  window.UIManagerPart2 = {
    // Attach event listeners
    attachEventListeners: (elements) => {
      // Floating button click
      elements.floatingBtn.addEventListener('click', () => {
        window.UIManager.togglePanel();
      });

      // Close button
      document.getElementById('queue-close-btn').addEventListener('click', () => {
        window.UIManager.closePanel();
      });

      // Minimize button
      document.getElementById('queue-minimize-btn').addEventListener('click', () => {
        window.UIManager.minimizePanel();
      });

      // Control buttons
      document.getElementById('queue-start-btn').addEventListener('click', () => {
        window.QueueManager.start();
      });

      document.getElementById('queue-pause-btn').addEventListener('click', async () => {
        const data = await window.StorageManager.getAll();
        if (data.queueState.isPaused) {
          window.QueueManager.resume();
        } else {
          window.QueueManager.pause();
        }
      });

      document.getElementById('queue-stop-btn').addEventListener('click', () => {
        if (confirm('Queue\'yu durdurmak istediğinizden emin misiniz?')) {
          window.QueueManager.stop();
        }
      });

      document.getElementById('queue-clear-btn').addEventListener('click', () => {
        if (confirm('Tüm queue\'yu temizlemek istediğinizden emin misiniz?')) {
          window.QueueManager.clearAll();
        }
      });

      // Form submission
      document.getElementById('queue-add-form').addEventListener('submit', (e) => {
        e.preventDefault();
        window.UIManager.handleAddItem();
      });

      // Queue item actions (event delegation)
      document.getElementById('queue-items-container').addEventListener('click', (e) => {
        const btn = e.target.closest('.queue-item-btn');
        if (!btn) return;

        const action = btn.getAttribute('data-action');
        const itemId = btn.getAttribute('data-item-id');

        switch(action) {
          case 'edit':
            window.UIManagerPart3.editItem(itemId);
            break;
          case 'delete':
            window.UIManagerPart3.deleteItem(itemId);
            break;
          case 'move-up':
            window.UIManagerPart3.moveItemUp(itemId);
            break;
          case 'move-down':
            window.UIManagerPart3.moveItemDown(itemId);
            break;
          case 'skip':
            window.UIManagerPart3.skipItem();
            break;
        }
      });

      // Project search
      const projectInput = document.getElementById('queue-project-input');
      let projectTimeout;
      projectInput.addEventListener('input', (e) => {
        clearTimeout(projectTimeout);
        projectTimeout = setTimeout(() => {
          window.UIManager.searchProjects(e.target.value);
        }, 300);
      });
      projectInput.addEventListener('focus', () => {
        // Show all projects on focus
        window.UIManager.searchProjects('');
      });

      // Task search
      const taskInput = document.getElementById('queue-task-input');
      let taskTimeout;
      taskInput.addEventListener('input', (e) => {
        clearTimeout(taskTimeout);
        taskTimeout = setTimeout(() => {
          window.UIManager.searchTasks(e.target.value);
        }, 300);
      });
      taskInput.addEventListener('focus', () => {
        // Show all tasks on focus (if project selected)
        const projectId = document.getElementById('queue-project-id').value;
        if (projectId) {
          window.UIManager.searchTasks('');
        }
      });

      // Trello search
      const trelloInput = document.getElementById('queue-trello-input');
      let trelloTimeout;
      trelloInput.addEventListener('input', (e) => {
        clearTimeout(trelloTimeout);
        trelloTimeout = setTimeout(() => {
          window.UIManager.searchTrelloTasks(e.target.value);
        }, 300);
      });
      trelloInput.addEventListener('focus', () => {
        // Show all trello tasks on focus (if project selected)
        const projectId = document.getElementById('queue-project-id').value;
        if (projectId) {
          window.UIManager.searchTrelloTasks('');
        }
      });

      // Close results when clicking outside
      document.addEventListener('click', (e) => {
        const projectResults = document.getElementById('queue-project-results');
        const taskResults = document.getElementById('queue-task-results');
        const trelloResults = document.getElementById('queue-trello-results');
        
        if (projectResults && !projectResults.contains(e.target) && e.target !== projectInput) {
          projectResults.style.display = 'none';
        }
        
        if (taskResults && !taskResults.contains(e.target) && e.target !== taskInput) {
          taskResults.style.display = 'none';
        }
        
        if (trelloResults && !trelloResults.contains(e.target) && e.target !== trelloInput) {
          trelloResults.style.display = 'none';
        }
      });

      // Draggable panel
      window.UIManager.makePanelDraggable();

      // Listen for queue updates
      window.addEventListener('queue-progress-update', () => {
        window.UIManager.updateUI();
      });

      // Before unload warning
      window.addEventListener('beforeunload', async (e) => {
        const data = await window.StorageManager.getAll();
        if (data.queueState.isRunning && !data.queueState.isPaused) {
          e.preventDefault();
          e.returnValue = 'Queue çalışıyor. Emin misiniz?';
          return e.returnValue;
        }
      });
    },

    // Toggle panel visibility
    togglePanel: (elements) => {
      elements.panel.classList.toggle('active');
      if (elements.panel.classList.contains('active')) {
        window.UIManager.updateUI();
      }
    },

    // Close panel
    closePanel: (elements) => {
      elements.panel.classList.remove('active');
    },

    // Minimize panel
    minimizePanel: () => {
      // You can add minimize animation here
      window.UIManager.closePanel();
    },

    // Make panel draggable
    makePanelDraggable: (elements) => {
      const header = document.getElementById('queue-header');
      const panel = elements.panel;
      let isDragging = false;
      let currentX, currentY, initialX, initialY;

      header.addEventListener('mousedown', (e) => {
        isDragging = true;
        initialX = e.clientX - panel.offsetLeft;
        initialY = e.clientY - panel.offsetTop;
      });

      document.addEventListener('mousemove', (e) => {
        if (isDragging) {
          e.preventDefault();
          currentX = e.clientX - initialX;
          currentY = e.clientY - initialY;
          
          panel.style.left = currentX + 'px';
          panel.style.top = currentY + 'px';
          panel.style.right = 'auto';
          panel.style.bottom = 'auto';
        }
      });

      document.addEventListener('mouseup', () => {
        isDragging = false;
      });
    },

    // Search projects
    searchProjects: async (query) => {
      const resultsDiv = document.getElementById('queue-project-results');

      try {
        const response = await window.APIManager.getClients();
        const projects = [];
        
        response.clients.forEach(client => {
          client.Projects.forEach(project => {
            const displayName = `${project.name} (${client.name})`;
            // If query is empty, show all; otherwise filter
            if (!query || displayName.toLowerCase().includes(query.toLowerCase())) {
              projects.push({
                id: project.id,
                name: project.name,
                clientName: client.name,
                clientId: client.id,
                displayName
              });
            }
          });
        });
        
        if (projects.length === 0) {
          resultsDiv.style.display = 'none';
          resultsDiv.innerHTML = '';
          return;
        }

        // Show autocomplete results
        resultsDiv.innerHTML = projects.map(project => `
          <div class="autocomplete-item" data-project='${JSON.stringify(project)}'>
            <div class="autocomplete-item-title">${project.name}</div>
            <div class="autocomplete-item-subtitle">${project.clientName}</div>
          </div>
        `).join('');
        
        resultsDiv.style.display = 'block';
        resultsDiv.classList.add('autocomplete-results');
        
        // Add click handlers
        resultsDiv.querySelectorAll('.autocomplete-item').forEach(item => {
          item.addEventListener('click', () => {
            const project = JSON.parse(item.getAttribute('data-project'));
            
            document.getElementById('queue-project-input').value = project.displayName;
            document.getElementById('queue-project-id').value = project.id;
            document.getElementById('queue-client-id').value = project.clientId;
            
            // Enable task input
            document.getElementById('queue-task-input').disabled = false;
            document.getElementById('queue-trello-input').disabled = false;
            
            resultsDiv.style.display = 'none';
            resultsDiv.innerHTML = '';
          });
        });
      } catch (error) {
        console.error('Error searching projects:', error);
        resultsDiv.style.display = 'none';
      }
    },

    // Search tasks (action items)
    searchTasks: async (query) => {
      const resultsDiv = document.getElementById('queue-task-results');
      const projectIdInput = document.getElementById('queue-project-id');
      
      if (!projectIdInput.value) {
        // Don't show error on focus, just keep it closed
        resultsDiv.style.display = 'none';
        return;
      }

      try {
        const response = await window.APIManager.getTasks(projectIdInput.value);
        // If query is empty, show all; otherwise filter
        const tasks = response.tasks.Tasks.filter(task => 
          !query || task.name.toLowerCase().includes(query.toLowerCase())
        );
        
        if (tasks.length === 0) {
          resultsDiv.style.display = 'none';
          resultsDiv.innerHTML = '';
          return;
        }

        // Show autocomplete results grouped by department
        const grouped = {};
        tasks.forEach(task => {
          const dept = task.Department?.name || 'Diğer';
          if (!grouped[dept]) grouped[dept] = [];
          grouped[dept].push(task);
        });

        let html = '';
        Object.keys(grouped).forEach(dept => {
          html += `<div class="autocomplete-item-subtitle" style="padding: 6px 12px; background: #f7fafc; font-weight: 600;">${dept}</div>`;
          grouped[dept].forEach(task => {
            html += `
              <div class="autocomplete-item" data-task='${JSON.stringify({ id: task.id, name: task.name, billable: task.billable })}'>
                <div class="autocomplete-item-title">${task.name}</div>
              </div>
            `;
          });
        });
        
        resultsDiv.innerHTML = html;
        resultsDiv.style.display = 'block';
        resultsDiv.classList.add('autocomplete-results');
        
        // Add click handlers
        resultsDiv.querySelectorAll('.autocomplete-item').forEach(item => {
          item.addEventListener('click', () => {
            const task = JSON.parse(item.getAttribute('data-task'));
            
            document.getElementById('queue-task-input').value = task.name;
            document.getElementById('queue-task-id').value = task.id;
            
            // Auto fill notes
            const noteInput = document.getElementById('queue-note-input');
            if (!noteInput.value) {
              noteInput.value = task.name;
            }
            
            resultsDiv.style.display = 'none';
            resultsDiv.innerHTML = '';
          });
        });
      } catch (error) {
        console.error('Error searching tasks:', error);
        await window.NotificationManager.add('error', 'Task\'lar yüklenemedi');
        resultsDiv.style.display = 'none';
      }
    },

    // Search trello tasks
    searchTrelloTasks: async (query) => {
      const resultsDiv = document.getElementById('queue-trello-results');
      const projectIdInput = document.getElementById('queue-project-id');
      
      if (!projectIdInput.value) {
        resultsDiv.style.display = 'none';
        return;
      }
      
      // For Trello, show placeholder on empty query
      if (!query) {
        resultsDiv.innerHTML = `
          <div class="autocomplete-item" style="cursor: default; opacity: 0.6;">
            <div class="autocomplete-item-title">Trello task aramak için yazın...</div>
            <div class="autocomplete-item-subtitle">En az 2 karakter gerekli</div>
          </div>
        `;
        resultsDiv.style.display = 'block';
        return;
      }
      
      if (query.length < 2) {
        resultsDiv.style.display = 'none';
        return;
      }

      try {
        const response = await window.APIManager.searchTrelloTasks(query, projectIdInput.value);
        
        if (!response.tasks || response.tasks.length === 0) {
          resultsDiv.style.display = 'none';
          resultsDiv.innerHTML = '';
          return;
        }

        // Show autocomplete results
        resultsDiv.innerHTML = response.tasks.map(task => `
          <div class="autocomplete-item" data-task='${JSON.stringify({ id: task.id, title: task.title })}'>
            <div class="autocomplete-item-title">${task.title}</div>
            <div class="autocomplete-item-subtitle">ID: ${task.id}</div>
          </div>
        `).join('');
        
        resultsDiv.style.display = 'block';
        resultsDiv.classList.add('autocomplete-results');
        
        // Add click handlers
        resultsDiv.querySelectorAll('.autocomplete-item').forEach(item => {
          item.addEventListener('click', () => {
            const task = JSON.parse(item.getAttribute('data-task'));
            
            document.getElementById('queue-trello-input').value = task.title;
            document.getElementById('queue-trello-id').value = task.id;
            
            // Auto fill notes
            const noteInput = document.getElementById('queue-note-input');
            noteInput.value = task.title;
            
            resultsDiv.style.display = 'none';
            resultsDiv.innerHTML = '';
          });
        });
      } catch (error) {
        console.error('Error searching trello:', error);
        resultsDiv.style.display = 'none';
      }
    },

    // Handle add item
    handleAddItem: async () => {
      const projectInput = document.getElementById('queue-project-input');
      const projectIdInput = document.getElementById('queue-project-id');
      const clientIdInput = document.getElementById('queue-client-id');
      const taskInput = document.getElementById('queue-task-input');
      const taskIdInput = document.getElementById('queue-task-id');
      const trelloIdInput = document.getElementById('queue-trello-id');
      const noteInput = document.getElementById('queue-note-input');
      const durationInput = document.getElementById('queue-duration-input');

      if (!projectIdInput.value || !taskIdInput.value || !noteInput.value || !durationInput.value) {
        await window.NotificationManager.add('warning', 'Lütfen tüm alanları doldurun!');
        return;
      }

      const duration = parseInt(durationInput.value);

      if (duration < 1) {
        await window.NotificationManager.add('warning', 'Süre en az 1 dakika olmalı!');
        return;
      }

      // Check daily limit
      const dailyStats = await window.StorageManager.get(window.STORAGE_KEYS.DAILY_STATS);
      if (dailyStats.dailyUsed + duration > window.CONFIG.DAILY_LIMIT) {
        await window.NotificationManager.add('error', 
          `Günlük limit aşımı! Eklenebilecek maksimum: ${window.Utils.formatMinutes(window.CONFIG.DAILY_LIMIT - dailyStats.dailyUsed)}`
        );
        return;
      }

      const itemData = {
        projectId: projectIdInput.value,
        projectName: projectInput.value,
        taskId: taskIdInput.value,
        taskName: taskInput.value,
        trelloId: trelloIdInput.value || null,
        notes: noteInput.value,
        duration: duration
      };

      await window.QueueManager.addItem(itemData);

      // Reset form
      projectInput.value = '';
      projectIdInput.value = '';
      clientIdInput.value = '';
      taskInput.value = '';
      taskInput.disabled = true;
      taskIdInput.value = '';
      document.getElementById('queue-trello-input').value = '';
      document.getElementById('queue-trello-input').disabled = true;
      trelloIdInput.value = '';
      noteInput.value = '';
      durationInput.value = '';

      window.UIManager.updateUI();
    }
  };

})();
