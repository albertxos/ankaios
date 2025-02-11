const protobuf = require('protobufjs');
const fs = require('fs');
const util = require('util')

const WAITING_TIME_IN_SEC = 5;

let StateChangeRequestMessage;
let ExecutionRequestMessage;
let UpdateStrategyEnum;

function write_to_control_interface(root, message) {
    StateChangeRequestMessage = root.lookupType("ankaios.StateChangeRequest");
    let buffer = StateChangeRequestMessage.encodeDelimited(message).finish(); // use length-delimited encoding!!!

    const ci_output_path = '/run/ankaios/control_interface/output';
    fs.writeFile(ci_output_path, buffer, { flag: 'a+' }, err => {
        if (err) {
            console.error(err);
        }
    });
}

function create_update_workload_request(root) {
    // Build StateChangeRequest.UpdateState request to add a new workload dynamic_nginx
    StateChangeRequestMessage = root.lookupType("ankaios.StateChangeRequest");
    UpdateStrategyEnum = root.lookupEnum("ankaios.UpdateStrategy");
    let payload = {
        updateState: {
            newState: {
                currentState: {
                    workloads: {
                        dynamic_nginx: {
                            agent: "agent_A",
                            runtime: "podman",
                            restart: true,
                            updateStrategy: UpdateStrategyEnum.AT_MOST_ONCE,
                            runtimeConfig: "image: docker.io/library/nginx\ncommandOptions: [\"-p\", \"8080:80\"]"
                        }
                    }
                },
            },
            updateMask: [
                "currentState.workloads.dynamic_nginx"
            ]
        }
    };
    const errMsg = StateChangeRequestMessage.verify(payload);
    if (errMsg) {
        throw Error(errMsg);
    }

    return StateChangeRequestMessage.create(payload);
}

function create_request_complete_state_request(root) {
    // Build StateChangeRequest.RequestCompletestate request to request the workload states
    StateChangeRequestMessage = root.lookupType("ankaios.StateChangeRequest");
    let payload = {
        requestCompleteState: {
            requestId: "request_id",
            fieldMask: ["workloadStates"]
        }
    };
    if (StateChangeRequestMessage.verify(payload)) {
        throw Error(errMsg);
    }

    return StateChangeRequestMessage.create(payload);
}

function decode_execution_request_message(root, data) {
    ExecutionRequestMessage = root.lookupType("ankaios.ExecutionRequest");
    const decoded_message = ExecutionRequestMessage.decodeDelimited(data);
    console.log(`[${new Date().toISOString()}] Receiving ExecutionRequest containing the workload states of the current state:\n ExecutionRequest `, util.inspect(decoded_message.toJSON(), { depth: null }));
}

function read_from_control_interface(root, decode_func) {
    const ci_input_path = '/run/ankaios/control_interface/input';
    const fifo = fs.createReadStream(ci_input_path);
    fifo.on('data', data => {
        try {
            decode_func(root, data)
        } catch (e) {
            if (e instanceof protobuf.util.ProtocolError) {
                console.error(e);
            } else {
                // wire format is invalid
                console.error(`invalid wire format: `, e);
            }
        }
    });
}

async function main() {
    protobuf.load("/usr/local/lib/ankaios/ankaios.proto", async function (err, root) {
        if (err) throw err;

        // Send StateChangeRequest.UpdateState to Ankaios Server
        const message = create_update_workload_request(root);
        console.log(`[${new Date().toISOString()}] Sending StateChangeRequest containing details for adding the dynamic workload "dynamic_nginx":\n StateChangeRequest `, util.inspect(message.toJSON(), { depth: null }));
        write_to_control_interface(root, message);

        read_from_control_interface(root, decode_execution_request_message);

        const send_request_complete_state = async () => {
            // Send StateChangeRequest.RequestCompletestate to Ankaios Server
            const message = create_request_complete_state_request(root);
            console.log(`[${new Date().toISOString()}] Sending StateChangeRequest containing details for requesting all workload states:\n StateChangeRequest `, util.inspect(message.toJSON(), { depth: null }));
            write_to_control_interface(root, message);
        }

        setInterval(send_request_complete_state, WAITING_TIME_IN_SEC * 1000); // StateChangeRequest.RequestCompletestate every x secs according to WAITING_TIME.
    });
}

main();


