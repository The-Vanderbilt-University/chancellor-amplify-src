import {FolderInterface} from "@/types/folder";
import HomeContext from "@/pages/api/home/home.context";
import {Conversation} from "@/types/chat";
import React, {FC, useContext, useEffect, useRef, useState} from "react";
import {Prompt} from "@/types/prompt";
import {TagsList} from "@/components/Chat/TagsList";
import {createExport, exportData, importData} from "@/utils/app/importExport";
import {useUser} from '@auth0/nextjs-auth0/client';
import {loadSharedItem, shareItems} from "@/services/shareService";
import styled, {keyframes} from "styled-components";
import {FiCommand} from "react-icons/fi";
import Folder from "@/components/Folder";
import {ExportFormatV4, LatestExportFormat} from "@/types/export";

export interface ImportModalProps {
    onImport: (importData: ExportFormatV4) => void;
    onCancel: () => void;
    includeConversations: boolean;
    includePrompts: boolean;
    includeFolders: boolean;
    importKey: string;
    note: string;
    importFetcher?: ImportFetcher;
    importButtonLabel?: string;
    title?: string;
    customImportFn?: (conversations:Conversation[], folders:FolderInterface[], prompts:Prompt[]) => void;
}

export interface ImportFetcher {
    (): Promise<{success:boolean, message:string, data: ExportFormatV4|null}>;
}

const animate = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(720deg);
  }
`;

const LoadingIcon = styled(FiCommand)`
  color: lightgray;
  font-size: 4rem;
  animation: ${animate} 2s infinite;
`;

export const ImportAnythingModal: FC<ImportModalProps> = (
    {
        onImport,
        onCancel,
        includePrompts,
        includeConversations,
        includeFolders,
        importKey,
        note,
        importFetcher,
        customImportFn,
        importButtonLabel = "Import",
        title = "Choose Shared Items to Accept",
    }) => {


    const {
        state: {prompts: localPrompts, conversations: localConversations, folders: localFolders},
        dispatch: homeDispatch
    } = useContext(HomeContext);

    const {user} = useUser();

    // Individual states for selected prompts, conversations, and folders
    const [isImporting, setIsImporting] = useState(true);
    const [prompts, setPrompts] = useState<Prompt[]>([]);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [folders, setFolders] = useState<FolderInterface[]>([]);
    const [selectedPromptsState, setSelectedPrompts] = useState<Prompt[]>([]);
    const [selectedConversationsState, setSelectedConversations] = useState<Conversation[]>([]);
    const [selectedFoldersState, setSelectedFolders] = useState<FolderInterface[]>([]);
    const itemRefs = useRef<Record<string, React.RefObject<HTMLDivElement>>>({});
    const [promptsChecked, setPromptsChecked] = useState(false);
    const [conversationsChecked, setConversationsChecked] = useState(false);
    const [foldersChecked, setFoldersChecked] = useState(false);

    const handlePromptsCheck = (checked: boolean) => {
        // if checked, add all prompts to selected, else remove them
        setSelectedPrompts(checked ? prompts : []);
        setPromptsChecked(checked);
    };

    const handleConversationsCheck = (checked: boolean) => {
        setSelectedConversations(checked ? conversations : []);
        setConversationsChecked(checked);
    };

    const handleFoldersCheck = (checked: boolean) => {
        setSelectedFolders(checked ? folders : []);
        setFoldersChecked(checked);
    };

    const handleItemSelect = (item: Prompt | Conversation | FolderInterface, itemType: string) => {
        switch (itemType) {
            case 'Prompt': {
                const prompt = item as Prompt;

                if (!selectedPromptsState.some(i => i.id === prompt.id)) {
                    let promptsToSelect = [prompt];

                    // See if the prompt has a data.rootPromptId that is in the selected prompts
                    // and if not, select it
                    if (prompt.data?.rootPromptId) {
                        const rootPrompt = prompts.find(p => p.id === prompt.data?.rootPromptId);
                        if (rootPrompt && !selectedPromptsState.some(i => i.id === rootPrompt.id)) {
                            promptsToSelect.push(rootPrompt);
                        }
                    }
                    setSelectedPrompts([...selectedPromptsState, ...promptsToSelect]);
                } else {
                    setSelectedPrompts(prevItems => toggleItem(prevItems, item as Prompt));
                }
                break;
            }
            case 'Conversation': {
                setSelectedConversations(prevItems => toggleItem(prevItems, item as Conversation));
                break;
            }
            case 'Folder': {
                const folder = item as FolderInterface;
                if (selectedFoldersState.some(i => i.id === folder.id)) {
                    // If the folder is currently selected, we are deselecting it
                    if (folder.type === 'prompt') {
                        setSelectedPrompts(prevPrompts => prevPrompts.filter(p => p.folderId !== folder.id));
                    } else if (folder.type === 'chat') {
                        setSelectedConversations(prevConversations => prevConversations.filter(c => c.folderId !== folder.id));
                    }
                } else {
                    // If the folder is currently deselected, we are selecting it
                    if (folder.type === 'prompt') {
                        const folderPrompts = prompts.filter(prompt => prompt.folderId === folder.id);
                        setSelectedPrompts(prevPrompts => [...prevPrompts, ...folderPrompts]);
                    } else if (folder.type === 'chat') {
                        const folderConversations = conversations.filter(conversation => conversation.folderId === folder.id);
                        setSelectedConversations(prevConversations => [...prevConversations, ...folderConversations]);
                    }
                }

                setSelectedFolders(prevItems => toggleItem(prevItems, folder));

                break;
            }
            default:
                return;
        }
    }

    const toggleItem = <T, >(items: Array<T>, item: T) => {
        return items.some(i => i === item) ? items.filter(i => i !== item) : [...items, item];
    }

    const canImport = () => {
        return (selectedPromptsState.length > 0 || selectedConversationsState.length > 0 || selectedFoldersState.length > 0);
    }

    const handleImport = async () => {

        if(customImportFn) {
            customImportFn(selectedConversationsState, selectedFoldersState, selectedPromptsState);
            return;
        }

        //onSave(selectedItems);
        const exportData = createExport(selectedConversationsState, selectedFoldersState, selectedPromptsState);

        const needsFolderReset = (item: Conversation | Prompt) => {
            return item.folderId != null &&
                !exportData.folders.some(folder => folder.id === item.folderId) &&
                !localFolders.some(folder => folder.id === item.folderId)
        };

        // Check if any of the folders of the prompts or conversations don't exist in local folders
        // and if so, set the folder to null
        const promptsToSetFolderToNull = exportData.prompts.filter(needsFolderReset);
        const conversationsToSetFolderToNull = exportData.history.filter(needsFolderReset);

        console.log("Prompts needing folder reset: ", promptsToSetFolderToNull);
        console.log("Conversations needing folder reset: ", conversationsToSetFolderToNull);

        const cleanedUpExport = createExport(
            exportData.history.map(conversation => {
                return conversationsToSetFolderToNull.some(c => c.id === conversation.id) ? {
                    ...conversation,
                    folderId: null
                } : conversation;
            }),
            exportData.folders,
            exportData.prompts.map(prompt => {
                return promptsToSetFolderToNull.some(p => p.id === prompt.id) ? {...prompt, folderId: null} : prompt;
            }));

        console.log("Cleaned up export: ", cleanedUpExport);

        const {history, folders, prompts}: LatestExportFormat = importData(cleanedUpExport);

        console.log("Imported prompts, conversations, and folders: ", prompts, history, folders);

        homeDispatch({field: 'conversations', value: history});

        if(history && history.length > 0) {
            homeDispatch({
                field: 'selectedConversation',
                value: history[history.length - 1],
            });
        }
        homeDispatch({field: 'folders', value: folders});
        homeDispatch({field: 'prompts', value: prompts});

        onImport(exportData);
        resetSelection();
        //window.location.reload();
    }

    const isSelected = (item: { id: string; }, itemType: string) => {
        switch (itemType) {
            case 'Prompt':
                return selectedPromptsState.some(selectedItem => selectedItem.id === item.id);
            case 'Conversation':
                return selectedConversationsState.some(selectedItem => selectedItem.id === item.id);
            case 'Folder':
                return selectedFoldersState.some(selectedItem => selectedItem.id === item.id);
            default:
                return false;
        }
    };

    // Add necessary useEffects

    const renderItem = (item: Prompt | Conversation | FolderInterface, itemType: string) => {


        // Create a new ref for each item if it does not exist yet.
        if (!itemRefs.current[item.id]) {
            itemRefs.current[item.id] = React.createRef();
        }

        return (
            <div className="flex items-center p-2" ref={itemRefs.current[item.id]} key={item.id}>
                <input
                    type="checkbox"
                    className="form-checkbox rounded-lg border border-neutral-500 shadow focus:outline-none dark:border-neutral-800 dark:bg-[#40414F] dark:focus:bg-neutral-700 dark:ring-offset-neutral-300 dark:border-opacity-50"
                    checked={isSelected(item, itemType)}
                    onChange={() => {
                        handleItemSelect(item, itemType)
                    }}
                />
                <div className="ml-2 text-black dark:text-white">{`${itemType} : ${item.name}`}</div>
            </div>
        );
    };

    const renderScrollableSection = (items: Array<Prompt | Conversation | FolderInterface>, itemType: string) => {
        return (
            <div style={{height: "100px", overflowY: "scroll"}}>
                {items.map((item) =>
                    renderItem(item, itemType)
                )}
            </div>
        );
    };

    function resetSelection() {
        setSelectedPrompts([]);
        setSelectedConversations([]);
        setSelectedFolders([]);
    }

    const initWithImportData = (sharedData: ExportFormatV4) => {
        setPrompts(sharedData.prompts);
        setSelectedPrompts(sharedData.prompts);
        setConversations(sharedData.history);
        setSelectedConversations(sharedData.history);
        setFolders(sharedData.folders);
        setSelectedFolders(sharedData.folders);
    }

    useEffect(() => {


        const fetchData = async () => {

            if (user && user.name) {

                const shareFetcher:ImportFetcher = async () => {

                    const result = await loadSharedItem(user?.name || "", importKey);
                    if (result.ok) {
                        const item = await result.json();
                        const sharedData = JSON.parse(item.item) as ExportFormatV4;

                        return {success: true, message:"Loaded share successfully.", data: sharedData};
                    } else {
                        return {success: false, message:"Failed to load share.", data: null};
                    }
                }

                console.log("Import fetcher: ", importFetcher);

                const result = (importFetcher) ?
                    await importFetcher() :
                    await shareFetcher();

                if (result.success) {
                    const sharedData = result.data;
                    console.log(sharedData);

                    if(sharedData) {
                        initWithImportData(sharedData);
                    } else {
                        alert("Unable to find item. It may have been removed.");
                    }

                    setIsImporting(false);
                } else {
                    alert("Unable to find shared item. It may have been deleted.");
                    resetSelection();
                    onCancel();
                }

            }

            // setSelectedPrompts([...prompts]);
            // setSelectedConversations([...conversations]);
            // setSelectedFolders([...folders]);

        };

        fetchData();


    }, []);


    // ...Other Code...

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="fixed inset-0 z-10 overflow-hidden">
                <div
                    className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                    <div className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true"/>
                    <div
                        className="border-neutral-400 dark:border-netural-400 inline-block transform overflow-y-auto rounded-lg border border-gray-300 bg-white px-4 py-5 text-left align-bottom shadow-xl transition-all dark:bg-[#202123] sm:my-8 sm:max-w-lg sm:p-6 sm:align-middle"
                        role="dialog"
                    >
                        {
                            isImporting && (
                                <div className="flex flex-col items-center justify-center">
                                    <LoadingIcon/>
                                    <span className="text-black dark:text-white text-xl font-bold mt-4">
                                      Importing...
                                    </span>
                                </div>
                            )
                        }

                        {!isImporting && (
                            <>
                                <h2 className="text-black dark:text-white text-xl font-bold">
                                    {title}
                                </h2>

                                <div className="overflow-y-auto" style={{maxHeight: "calc(100vh - 200px)"}}>

                                    <h3 className="text-black dark:text-white text-lg mt-4 border-b">Note</h3>
                                    <div
                                        className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                    >{note}</div>

                                    {includePrompts && prompts.length > 0 && (
                                        <>
                                            <div className="mt-3 flex items-center border-b ">
                                                <input
                                                    type="checkbox"
                                                    className="mx-2 form-checkbox rounded-lg border border-neutral-500 shadow focus:outline-none dark:border-neutral-800 dark:bg-[#40414F] dark:ring-offset-neutral-300 dark:border-opacity-50"
                                                    checked={promptsChecked}
                                                    onChange={(e) => handlePromptsCheck(e.target.checked)}
                                                />
                                                <h3 className="ml-2 text-black dark:text-white text-lg">Prompts</h3>
                                            </div>
                                            {renderScrollableSection(prompts, 'Prompt')}
                                        </>
                                    )}

                                    {includeConversations && conversations.length > 0 && (
                                        <>
                                            <div className="mt-3 flex items-center border-b ">
                                                <input
                                                    type="checkbox"
                                                    className="mx-2 form-checkbox rounded-lg border border-neutral-500 shadow focus:outline-none dark:border-neutral-800 dark:bg-[#40414F] dark:ring-offset-neutral-300 dark:border-opacity-50"
                                                    checked={conversationsChecked}
                                                    onChange={(e) => handleConversationsCheck(e.target.checked)}
                                                />
                                                <h3 className="ml-2 text-black dark:text-white text-lg">Conversations</h3>
                                            </div>
                                            {renderScrollableSection(conversations, 'Conversation')}
                                        </>
                                    )}

                                    {includeFolders && folders.length > 0 && (
                                        <>
                                            <div className="mt-3 flex items-center border-b ">
                                                <input
                                                    type="checkbox"
                                                    className="mx-2 form-checkbox rounded-lg border border-neutral-500 shadow focus:outline-none dark:border-neutral-800 dark:bg-[#40414F] dark:ring-offset-neutral-300 dark:border-opacity-50"
                                                    checked={foldersChecked}
                                                    onChange={(e) => handleFoldersCheck(e.target.checked)}
                                                />
                                                <h3 className="ml-2 text-black dark:text-white text-lg">Folders</h3>
                                            </div>
                                            {renderScrollableSection(folders, 'Folder')}
                                        </>
                                    )}
                                </div>
                            </>
                        )}

                        <div className="pt-4 flex justify-end items-center border-t border-gray-200">

                            <button
                                type="button"
                                className="w-full px-4 py-2 mt-6 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    resetSelection();
                                    onCancel();
                                }}
                            >
                                Cancel
                            </button>
                            {!isImporting && (
                                <button
                                    type="button"
                                    style={{opacity: !canImport() ? 0.3 : 1}}
                                    className="ml-2 w-full px-4 py-2 mt-6 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300 ${selectedPeople.length === 0 || (selectedPromptsState.length === 0 && selectedConversationsState.length === 0 && selectedFoldersState.length === 0) ? 'cursor-not-allowed' : ''}"
                                    onClick={handleImport}
                                    disabled={!canImport()}
                                >
                                    {importButtonLabel}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};