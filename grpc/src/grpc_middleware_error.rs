// Copyright (c) 2023 Elektrobit Automotive GmbH
//
// This program and the accompanying materials are made available under the
// terms of the Apache License, Version 2.0 which is available at
// https://www.apache.org/licenses/LICENSE-2.0.
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations
// under the License.
//
// SPDX-License-Identifier: Apache-2.0
use std::fmt;

use api::proto::{ExecutionRequest, StateChangeRequest};
use common::{
    communications_error::CommunicationMiddlewareError, execution_interface::ExecutionCommandError,
    state_change_interface::StateChangeCommandError,
};
use tokio::sync::mpsc::error::SendError;

#[derive(Debug, Clone)]
pub enum GrpcMiddlewareError {
    StartError(String),
    ReceiveError(String),
    SendError(String),
    ConversionError(String),
    ServerNotAvailable(String),
    ConnectionInterrupted(String),
}

impl From<GrpcMiddlewareError> for CommunicationMiddlewareError {
    fn from(error: GrpcMiddlewareError) -> Self {
        CommunicationMiddlewareError(error.to_string())
    }
}

impl From<ExecutionCommandError> for GrpcMiddlewareError {
    fn from(error: ExecutionCommandError) -> Self {
        GrpcMiddlewareError::SendError(error.to_string())
    }
}

impl From<StateChangeCommandError> for GrpcMiddlewareError {
    fn from(error: StateChangeCommandError) -> Self {
        GrpcMiddlewareError::SendError(error.to_string())
    }
}

impl From<SendError<StateChangeRequest>> for GrpcMiddlewareError {
    fn from(error: SendError<StateChangeRequest>) -> Self {
        GrpcMiddlewareError::SendError(error.to_string())
    }
}

impl From<SendError<Result<ExecutionRequest, tonic::Status>>> for GrpcMiddlewareError {
    fn from(error: SendError<Result<ExecutionRequest, tonic::Status>>) -> Self {
        GrpcMiddlewareError::SendError(error.to_string())
    }
}

impl From<tonic::Status> for GrpcMiddlewareError {
    fn from(err: tonic::Status) -> Self {
        GrpcMiddlewareError::ConnectionInterrupted(err.to_string())
    }
}

impl From<tonic::transport::Error> for GrpcMiddlewareError {
    fn from(err: tonic::transport::Error) -> Self {
        GrpcMiddlewareError::ServerNotAvailable(err.to_string())
    }
}

impl std::error::Error for GrpcMiddlewareError {}

impl fmt::Display for GrpcMiddlewareError {
    fn fmt(&self, f: &mut fmt::Formatter) -> Result<(), fmt::Error> {
        match self {
            GrpcMiddlewareError::StartError(message) => write!(f, "StartError: '{}'", message),
            GrpcMiddlewareError::ReceiveError(message) => write!(f, "ReceiveError: '{}'", message),
            GrpcMiddlewareError::SendError(message) => write!(f, "SendError: '{}'", message),
            GrpcMiddlewareError::ConversionError(message) => {
                write!(f, "ConversionError: '{}'", message)
            }
            GrpcMiddlewareError::ServerNotAvailable(message) => {
                write!(f, "Could not connect to the server: '{message}'")
            }
            GrpcMiddlewareError::ConnectionInterrupted(message) => {
                write!(f, "Connection interrupted: '{message}'")
            }
        }
    }
}
