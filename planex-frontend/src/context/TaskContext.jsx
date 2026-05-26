import React, { createContext, useState, useContext } from 'react';

const TaskContext = createContext()
export const TaskProvider = ({children}) => {
    const [tasks, setTasks] = useState([
        { id: 1, title: "task 1", description: "description for task 1", dueDate: "2026-06-30", collaborators: ["user1"], isCompleted: false, priority: "High" },
        { id: 2, title: "task 2", description: "description for task 2", dueDate: "2026-07-15", collaborators: [], isCompleted: true, priority: "Low" },
        { id: 3, title: "task 3", description: "description for task 3", dueDate: "2027.01.01", collaborators: ["user1", "user2"], isCompleted: false, priority: "Medium" },
        { id: 4, title: "task 4", description: "description for task 4", dueDate: "2027.02.01", collaborators: ["user5"], isCompleted: true, priority: "Low" },
        { id: 5, title: "task 5", description: "description for task 5", dueDate: "2026.12.01", collaborators: [], isCompleted: false, priority: "Medium" },
    ]);

    const addTask = (newTask) => {
        const taskWithId = { ...newTask, id: Date.now(), isCompleted: false };
        setTasks((prevTasks) => ([...prevTasks, taskWithId]));
    };

    const updateTask = (id, updatedData) => {
        setTasks((prevTasks) =>
            prevTasks.map((task) => task.id === id ? { ...task, ...updatedData } : task)
        );
    };

    const deleteTask = (id) => {
        setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));
    };

    const toggleTaskCompletion = (id) => {
        setTasks((prevTasks) =>
            prevTasks.map((task) => task.id === id ? { ...task, isCompleted: !task.isCompleted } : task)
        );
    };

    return (
        <TaskContext.Provider value={{ tasks, addTask, updateTask, deleteTask, toggleTaskCompletion }}>
            {children}
        </TaskContext.Provider>
    );
};

export const useTasks = () => {
    const context = useContext(TaskContext);
    if (!context) throw new Error("useTasks must be used within a TaskProvider");
    return context;
};