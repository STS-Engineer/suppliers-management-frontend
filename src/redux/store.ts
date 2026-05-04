import { combineReducers, legacy_createStore as createStore } from "redux";

type AuthState = {
  role: string[];
};

const initialAuthState: AuthState = {
  role: [],
};

const authReducer = (
  state: AuthState = initialAuthState,
  _action: { type: string },
): AuthState => state;

const rootReducer = combineReducers({
  auth: authReducer,
});

export const store = createStore(
  rootReducer,
  undefined,
);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
