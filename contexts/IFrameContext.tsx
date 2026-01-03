import React from 'react';

type IFrameContextValue = {
  playing: boolean;
};

const IFrameContext = React.createContext<IFrameContextValue>({
  playing: true,
});

export default IFrameContext;


