'use client'

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ReactNode } from 'react'

interface Props {
  mainContent: ReactNode
  sideContent?: ReactNode
}

export function ResizableLayout({ mainContent, sideContent }: Props) {
  return (
    <div className="flex-1 min-h-0">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel 
          id="main" 
          order={1} 
          defaultSize={sideContent ? 60 : 100}
          minSize={30}
        >
          <ScrollArea className="h-full [&_[data-radix-scroll-area-viewport]]:h-full [&_[data-radix-scroll-area-scrollbar]]:opacity-0 [&_[data-radix-scroll-area-scrollbar]]:transition-opacity hover:[&_[data-radix-scroll-area-scrollbar]]:opacity-100 [&_[data-radix-scroll-area-scrollbar]]:data-[state=visible]:opacity-100">
            <div className="h-full">
              {mainContent}
            </div>
          </ScrollArea>
        </ResizablePanel>

        {sideContent && (
          <>
            <ResizableHandle />
            <ResizablePanel 
              id="side" 
              order={2} 
              defaultSize={40}
              minSize={20}
            >
              {sideContent}
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  )
} 