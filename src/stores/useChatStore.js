import { create } from 'zustand'

const useChatStore = create((set) => ({
  activeConversationId: null,

  setActiveConversationId: (conversationId) => {
    set({
      activeConversationId: conversationId
    })
  }
}))

export default useChatStore
